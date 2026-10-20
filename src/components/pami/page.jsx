'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './page.module.css';

const STEP = 40;
const EJEMPLOS = ['65.00.01', '9.3', 'oncoplan', 'ecografía'];
const VACIO = { sec: '', sub: '', ssub: '' };

// "9.3 ONCOPLAN" -> "9.3"
const num = (s) => s?.match(/^\d+(?:\.\d+)*/)?.[0] ?? '';
const numKey = (s) => num(s).split('.').filter(Boolean).map(Number);
const porNumero = (a, b) => {
    const x = numKey(a), y = numKey(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? -1) - (y[i] ?? -1);
        if (d) return d;
    }
    return 0;
};
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// 650001 -> ['65','00','01']
const grupos = (c) => {
    const s = String(c ?? '').replace(/\D/g, '');
    const out = [];
    for (let i = s.length; i > 0; i -= 2) out.unshift(s.slice(Math.max(0, i - 2), i));
    return out;
};

// Distingue: "9.3" (título) · "65.00.01" (código) · "oncoplan" (texto)
const tipoQuery = (t) => {
    if (!t) return { tipo: 'none' };
    if (/^[\d.\s]+$/.test(t)) {
        const digits = t.replace(/\D/g, '');
        const path = t.trim().replace(/\.$/, '');
        if (/^\d{1,2}(\.\d{1,2}){0,2}$/.test(path) && digits.length <= 4) return { tipo: 'seccion', path };
        return { tipo: 'codigo', digits };
    }
    return { tipo: 'texto', t };
};

const CodeBadge = ({ codigo }) => {
    const g = grupos(codigo);
    return (
        <span className={styles.code} aria-label={`Código ${g.join(' ')}`}>
            {g.map((x, i) => (
                <span key={i}>
                    {i > 0 && <i className={styles.dot}>.</i>}
                    <b className={i === 0 ? styles.codeHead : undefined}>{x}</b>
                </span>
            ))}
        </span>
    );
};

const Lista = ({ titulo, items, tipo }) =>
    items?.length ? (
        <section className={`${styles.block} ${styles[tipo]}`}>
            <h4 className={styles.blockTitle}>{titulo}</h4>
            <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
    ) : null;

const Card = memo(function Card({ it, generales, onJump, onFiltro }) {
    const [open, setOpen] = useState(false);
    const [verGen, setVerGen] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const d = it.detalle;
    const usaGenerales = [...(d?.incluye ?? []), ...(d?.excluye ?? [])].some((t) => /generales de la internaci/i.test(t));

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(it.codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1200);
        } catch { }
    };

    const ruta = [
        it.seccion && { label: it.seccion, f: { sec: it.seccion, sub: '', ssub: '' } },
        it.subseccion && { label: it.subseccion, f: { sec: it.seccion, sub: it.subseccion, ssub: '' } },
        it.subsubseccion && { label: it.subsubseccion, f: { sec: it.seccion, sub: it.subseccion, ssub: it.subsubseccion } },
    ].filter(Boolean);

    return (
        <article className={styles.card}>
            <header className={styles.cardTop}>
                <CodeBadge codigo={it.codigo} />
                <button type="button" className={styles.copy} onClick={copiar} aria-label="Copiar código">
                    {copiado ? '✓ Copiado' : 'Copiar'}
                </button>
            </header>

            <p className={styles.desc}>{it.descripcion}</p>

            <nav className={styles.crumbs} aria-label="Ubicación en el nomenclador">
                {ruta.map((r, i) => (
                    <span key={i}>
                        {i > 0 && <span className={styles.sep}>›</span>}
                        <button type="button" onClick={() => onFiltro(r.f)}>{r.label}</button>
                    </span>
                ))}
            </nav>

            {d && (
                <>
                    <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
                        <span>{open ? 'Ocultar' : 'Ver'} inclusiones y exclusiones</span>
                        <span aria-hidden>{open ? '▴' : '▾'}</span>
                    </button>

                    {open && (
                        <div className={styles.detail}>
                            {d.heredaDe && (
                                <p className={styles.heredado}>
                                    Mismas inclusiones y exclusiones que
                                    <button type="button" onClick={() => onJump(d.heredaDe)}>
                                        <CodeBadge codigo={d.heredaDe} />
                                    </button>
                                </p>
                            )}
                            <Lista titulo="Prácticas comprendidas" items={d.practicas} tipo="neutro" />
                            <Lista titulo="Incluye" items={d.incluye} tipo="inc" />
                            <Lista titulo="Excluye" items={d.excluye} tipo="exc" />
                            <Lista titulo="Notas" items={d.notas} tipo="nota" />

                            {usaGenerales && generales && (
                                <>
                                    <button type="button" className={styles.link} onClick={() => setVerGen(!verGen)}>
                                        {verGen ? 'Ocultar' : 'Ver'} inclusiones y exclusiones generales
                                    </button>
                                    {verGen && (
                                        <>
                                            <Lista titulo="Inclusiones generales" items={generales.inc} tipo="inc" />
                                            <Lista titulo="Exclusiones generales" items={generales.exc} tipo="exc" />
                                        </>
                                    )}
                                </>
                            )}
                            <p className={styles.pag}>Fuente: Nomenclador PAMI, pág. {d.paginaDetalle}</p>
                        </div>
                    )}
                </>
            )}
        </article>
    );
});

const Tile = ({ titulo, n, onClick }) => (
    <button type="button" className={styles.tile} onClick={onClick}>
        <span className={styles.tileTitle}>{titulo}</span>
        <span className={styles.tileCount}>{n}</span>
    </button>
);

export default function NomencladorPami() {
    const [items, setItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [q, setQ] = useState('');
    const [f, setF] = useState(VACIO);
    const [todo, setTodo] = useState(false);
    const [limit, setLimit] = useState(STEP);
    const dq = useDeferredValue(q);
    const rootRef = useRef(null);
    const [tema, setTema] = useState('light');

    // Detecta tema oscuro por el color de texto que hereda del contenedor (funciona con cualquier toggle)
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        let raf = 0;
        const detect = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const rgb = getComputedStyle(el.parentElement ?? el).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
                const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
                setTema(lum > 0.6 ? 'dark' : 'light');
            });
        };
        detect();
        const mo = new MutationObserver(detect);
        mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class', 'data-theme'] });
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', detect);
        return () => { cancelAnimationFrame(raf); mo.disconnect(); mq.removeEventListener('change', detect); };
    }, []);

    useEffect(() => {
        fetch('/archivos/pami-nomenclador.json')
            .then((r) => r.json())
            .then((j) => { setItems(j.items); setMeta(j.meta); })
            .catch(() => console.warn('No se pudo cargar pami-nomenclador.json'));
    }, []);

    useEffect(() => setLimit(STEP), [dq, f, todo]);

    // --- Árbol de títulos: sección > subsección > sub-subsección ---
    const tree = useMemo(() => {
        const secs = new Map();
        for (const i of items) {
            let s = secs.get(i.seccion);
            if (!s) secs.set(i.seccion, (s = { n: 0, subs: new Map() }));
            s.n++;
            if (!i.subseccion) continue;
            let b = s.subs.get(i.subseccion);
            if (!b) s.subs.set(i.subseccion, (b = { n: 0, ssubs: new Map() }));
            b.n++;
            if (i.subsubseccion) b.ssubs.set(i.subsubseccion, (b.ssubs.get(i.subsubseccion) ?? 0) + 1);
        }
        return secs;
    }, [items]);

    const secList = useMemo(() => [...tree].sort((a, b) => porNumero(a[0], b[0])), [tree]);
    const subList = useMemo(
        () => (f.sec && tree.get(f.sec) ? [...tree.get(f.sec).subs].sort((a, b) => porNumero(a[0], b[0])) : []),
        [tree, f.sec]
    );
    const ssubList = useMemo(
        () => (f.sub && tree.get(f.sec)?.subs.get(f.sub) ? [...tree.get(f.sec).subs.get(f.sub).ssubs].sort((a, b) => porNumero(a[0], b[0])) : []),
        [tree, f.sec, f.sub]
    );

    // Lista plana de títulos para sugerir al escribir texto
    const titulos = useMemo(() => {
        const out = [];
        for (const [s, sv] of tree) {
            out.push({ label: s, n: sv.n, f: { sec: s, sub: '', ssub: '' } });
            for (const [b, bv] of sv.subs) {
                out.push({ label: b, n: bv.n, f: { sec: s, sub: b, ssub: '' } });
                for (const [c, n] of bv.ssubs) out.push({ label: c, n, f: { sec: s, sub: b, ssub: c } });
            }
        }
        return out;
    }, [tree]);

    const fuse = useMemo(
        () =>
            new Fuse(items, {
                keys: [
                    { name: 'codigo', weight: 3 },
                    { name: 'descripcion', weight: 1 },
                    { name: 'seccion', weight: 0.4 },
                    { name: 'subseccion', weight: 0.4 },
                    { name: 'subsubseccion', weight: 0.4 },
                ],
                threshold: 0.25,
                ignoreLocation: true,
            }),
        [items]
    );

    const hayFiltro = !!(f.sec || f.sub || f.ssub);
    const qq = useMemo(() => tipoQuery(dq.trim()), [dq]);

    const enFiltro = useCallback(
        (i) => (!f.sec || i.seccion === f.sec) && (!f.sub || i.subseccion === f.sub) && (!f.ssub || i.subsubseccion === f.ssub),
        [f]
    );

    const nivel = !f.sec ? 'sec' : !f.sub && subList.length > 0 && !todo ? 'sub' : 'lista';
    const mostrarTiles = qq.tipo === 'none' && nivel !== 'lista';

    const resultados = useMemo(() => {
        if (qq.tipo === 'none') return nivel === 'lista' ? items.filter(enFiltro) : [];
        const pool = hayFiltro ? items.filter(enFiltro) : items;
        if (qq.tipo === 'seccion')
            return pool.filter((i) => [i.seccion, i.subseccion, i.subsubseccion].some((x) => num(x) === qq.path));
        if (qq.tipo === 'codigo') return pool.filter((i) => i.codigo.startsWith(qq.digits));
        return fuse.search(qq.t, { limit: 600 }).map((r) => r.item).filter(enFiltro);
    }, [qq, items, fuse, enFiltro, hayFiltro, nivel]);

    const chipsTitulos = useMemo(() => {
        if (qq.tipo !== 'texto') return [];
        const t = norm(qq.t);
        return titulos.filter((x) => norm(x.label).includes(t)).slice(0, 8);
    }, [qq, titulos]);

    const generales = useMemo(
        () => (meta ? { inc: meta.inclusionesGenerales, exc: meta.exclusionesGenerales } : null),
        [meta]
    );

    const aplicarFiltro = useCallback((nf) => {
        setF(nf);
        setTodo(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);
    const irATitulo = (x) => { setQ(''); aplicarFiltro(x.f); };
    const onJump = useCallback((codigo) => { setF(VACIO); setTodo(false); setQ(codigo); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
    const limpiar = () => { setF(VACIO); setTodo(false); setQ(''); };

    const trail = [
        f.sec && { label: f.sec, f: { sec: f.sec, sub: '', ssub: '' } },
        f.sub && { label: f.sub, f: { sec: f.sec, sub: f.sub, ssub: '' } },
        f.ssub && { label: f.ssub, f: f },
    ].filter(Boolean);

    return (
        <div ref={rootRef} data-tema={tema} className={styles.page}>
            <div className={styles.search} role="search">
                <input
                    className={styles.input}
                    placeholder="Código (65.00.01), título (9.3) o práctica…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    inputMode="search"
                    autoComplete="off"
                    spellCheck={false}
                />
                {(q || hayFiltro) && <button type="button" className={styles.clear} onClick={limpiar}>Limpiar</button>}
            </div>

            {/* Filtros por título */}
            <div className={styles.filters}>
                <label className={styles.field}>
                    Sección
                    <select
                        className={styles.select}
                        value={f.sec}
                        onChange={(e) => aplicarFiltro({ sec: e.target.value, sub: '', ssub: '' })}
                    >
                        <option value="">Todas las secciones</option>
                        {secList.map(([s, v]) => <option key={s} value={s}>{s} ({v.n})</option>)}
                    </select>
                </label>
                <label className={styles.field}>
                    Subsección
                    <select
                        className={styles.select}
                        value={f.sub}
                        disabled={!subList.length}
                        onChange={(e) => aplicarFiltro({ sec: f.sec, sub: e.target.value, ssub: '' })}
                    >
                        <option value="">{subList.length ? 'Todas' : '—'}</option>
                        {subList.map(([s, v]) => <option key={s} value={s}>{s} ({v.n})</option>)}
                    </select>
                </label>
                {ssubList.length > 0 && (
                    <label className={styles.field}>
                        Detalle
                        <select
                            className={styles.select}
                            value={f.ssub}
                            onChange={(e) => aplicarFiltro({ sec: f.sec, sub: f.sub, ssub: e.target.value })}
                        >
                            <option value="">Todos</option>
                            {ssubList.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
                        </select>
                    </label>
                )}
            </div>

            {/* Camino de títulos activo */}
            {hayFiltro && (
                <nav className={styles.trail} aria-label="Filtro activo">
                    <button type="button" onClick={() => aplicarFiltro(VACIO)}>Todo</button>
                    {trail.map((t, i) => (
                        <span key={i}>
                            <span className={styles.sep}>›</span>
                            <button type="button" className={i === trail.length - 1 ? styles.trailActive : undefined} onClick={() => aplicarFiltro(t.f)}>
                                {t.label}
                            </button>
                        </span>
                    ))}
                </nav>
            )}

            {/* Títulos que coinciden con el texto */}
            {chipsTitulos.length > 0 && (
                <div className={styles.chips} aria-label="Títulos coincidentes">
                    {chipsTitulos.map((x) => (
                        <button key={x.label + x.f.sub} type="button" onClick={() => irATitulo(x)}>
                            {x.label} <small>{x.n}</small>
                        </button>
                    ))}
                </div>
            )}

            {/* Explorar por títulos */}
            {mostrarTiles && (
                <>
                    <p className={styles.count}>
                        {nivel === 'sec' ? 'Explorá por sección' : `${f.sec} · elegí una subsección`}
                    </p>
                    <div className={styles.tiles}>
                        {nivel === 'sec'
                            ? secList.map(([s, v]) => <Tile key={s} titulo={s} n={v.n} onClick={() => aplicarFiltro({ sec: s, sub: '', ssub: '' })} />)
                            : (
                                <>
                                    <Tile titulo={`Ver todo ${f.sec}`} n={tree.get(f.sec).n} onClick={() => setTodo(true)} />
                                    {subList.map(([s, v]) => <Tile key={s} titulo={s} n={v.n} onClick={() => aplicarFiltro({ sec: f.sec, sub: s, ssub: '' })} />)}
                                </>
                            )}
                    </div>
                    {nivel === 'sec' && (
                        <div className={styles.chips}>
                            {EJEMPLOS.map((e) => <button key={e} type="button" onClick={() => setQ(e)}>{e}</button>)}
                        </div>
                    )}
                </>
            )}

            {/* Resultados */}
            {!mostrarTiles && (
                resultados.length === 0 ? (
                    <div className={styles.empty}>Sin resultados.</div>
                ) : (
                    <>
                        <p className={styles.count}>{resultados.length} código{resultados.length !== 1 && 's'}</p>
                        <div className={styles.list}>
                            {resultados.slice(0, limit).map((it) => (
                                <Card key={it.codigo + it.pagina} it={it} generales={generales} onJump={onJump} onFiltro={aplicarFiltro} />
                            ))}
                        </div>
                        {resultados.length > limit && (
                            <button type="button" className={styles.more} onClick={() => setLimit(limit + STEP)}>
                                Ver más ({resultados.length - limit})
                            </button>
                        )}
                    </>
                )
            )}
        </div>
    );
}
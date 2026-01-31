'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConvenio } from './ConvenioContext';
import { money, normalize } from '../utils/calculos';
import Fuse from 'fuse.js';
import styles from './facturacion.module.css';

/* ================= Utils ================= */
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(text, q) {
  if (!text || !q) return text;
  const safe = escapeRegExp(q);
  const regex = new RegExp(`(${safe})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    part.toLowerCase() === String(q).toLowerCase() ? (
      <mark key={i} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const parseNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

  let s = String(val).trim();
  s = s.replace(/[^\d.,-]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length;

    if (dotCount === 1 && /^\-?\d+(\.\d{1,2})$/.test(s)) {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }

    s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const isRadiografia = (item) => {
  const d = normalize(item?.descripcion);
  return d.includes('radiograf') || d.includes('rx');
};

const isSubsiguiente = (item) => {
  const d = normalize(item?.descripcion);
  return d.includes('por exposicion subsiguiente') || d.includes('por exposición subsiguiente');
};

const vincularSubsiguientes = (item, data) => {
  const idx = data.findIndex((d) => d.__key === item.__key);
  if (idx === -1) return [item];

  const prev = data[idx - 1];
  const next = data[idx + 1];

  if (isSubsiguiente(item) && prev) return [prev, item];
  if (next && isSubsiguiente(next)) return [item, next];
  return [item];
};

/* ================= Prácticas Moduladas ================= */
const PRACTICAS_MODULADAS = [
  {
    tipo: 'modulada',
    codigo: 'MOD-001',
    descripcion: 'Artroscopia Hombro',
    valor: 1232200,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-002',
    descripcion: 'Artroscopia Simple Gastos Sanatoriales',
    valor: 900000,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-003',
    descripcion: 'Consulta',
    valor: 34650,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-004',
    descripcion: 'Curaciones Quemados',
    valor: 15540,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-005',
    descripcion: 'Curaciones R',
    valor: 8820,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-006',
    descripcion: 'ECG Y EX EN CV',
    valor: 63690,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-007',
    descripcion: 'Ecografia Partes Blandas No Moduladas',
    valor: 42000,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-008',
    descripcion: 'FKT',
    valor: 13486,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-009',
    descripcion: 'FKT + MGT',
    valor: 19250,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  },
  {
    tipo: 'modulada',
    codigo: 'MOD-010',
    descripcion: 'Lig Cruzado Gastos Sanatoriales',
    valor: 1123200,
    capitulo: 'MOD',
    capituloNombre: 'Prácticas Moduladas'
  }
];

/* ================= Componente Principal ================= */
export default function PracticasModule({ 
  practicasAgregadas, 
  agregarPractica, 
  onAtras, 
  onSiguiente 
}) {
  const { valoresConvenio } = useConvenio();
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});
  const [loading, setLoading] = useState(true);

  // Cargar nomenclador nacional
  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then((res) => res.json())
      .then((json) => {
        setCapitulos(json);

        const counts = new Map();
        const flat = json.flatMap((c) =>
          (c.practicas || []).map((p) => {
            const cap = String(c.capitulo ?? '').trim();
            const cod = String(p.codigo ?? '').trim();
            const base = `${cap}|${cod}`;

            const n = (counts.get(base) ?? 0) + 1;
            counts.set(base, n);

            return {
              tipo: 'nacional',
              ...p,
              capitulo: c.capitulo,
              capituloNombre: c.descripcion,
              qgal: parseNumber(p.q_gal || p.qgal),
              gto: parseNumber(p.gto),
              __key: `${base}#${n}`,
            };
          })
        );

        // Combinar con prácticas moduladas
        const allData = [...PRACTICAS_MODULADAS, ...flat];
        setData(allData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando JSON:', err);
        // Usar datos de ejemplo para desarrollo
        const datosEjemplo = [
          {
            tipo: 'nacional',
            capitulo: '34',
            capituloNombre: 'Radiología',
            codigo: '34.02.13',
            descripcion: 'CODO, MANO, MUÑECA, DEDOS, RODILLA, TOBILLO (FRENTE Y PERFIL)',
            qgal: 6.75,
            gto: 30,
            __key: '34|34.02.13#1'
          },
          ...PRACTICAS_MODULADAS
        ];
        setData(datosEjemplo);
        setLoading(false);
      });
  }, []);

  /* === FUSE (global) === */
  const fuseGlobal = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
      includeScore: true,
      threshold: 0.18,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [data]);

  /* === BUSCADOR GLOBAL === */
  const resultadosGlobales = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const qNorm = normalize(q);

    const exact = data.filter(
      (it) =>
        String(it.codigo ?? '').toLowerCase() === q.toLowerCase() ||
        normalize(it.descripcion).includes(qNorm)
    );

    let results = [];

    if (exact.length) {
      for (const it of exact) {
        // Solo vincular subsiguientes para prácticas nacionales
        if (it.tipo === 'nacional') {
          results.push(...vincularSubsiguientes(it, data.filter(d => d.tipo === 'nacional')));
        } else {
          results.push(it);
        }
      }
    } else if (fuseGlobal) {
      const found = fuseGlobal.search(q).map((r) => r.item);
      for (const it of found) {
        if (it.tipo === 'nacional') {
          results.push(...vincularSubsiguientes(it, data.filter(d => d.tipo === 'nacional')));
        } else {
          results.push(it);
        }
      }
    }

    // Eliminar duplicados por __key
    const unique = Array.from(new Map(results.map((it) => [it.__key || it.codigo, it])).values());

    // Ordenar: RX primero, luego moduladas, luego otras
    return unique.sort((a, b) => {
      const aIsRx = isRadiografia(a);
      const bIsRx = isRadiografia(b);
      const aIsMod = a.tipo === 'modulada';
      const bIsMod = b.tipo === 'modulada';
      
      if (aIsRx && !bIsRx) return -1;
      if (!aIsRx && bIsRx) return 1;
      if (aIsMod && !bIsMod) return -1;
      if (!aIsMod && bIsMod) return 1;
      return 0;
    });
  }, [query, data, fuseGlobal]);

  /* === CÁLCULO DE VALORES === */
  const calcularValorPractica = (item) => {
    if (item.tipo === 'modulada') {
      return item.valor;
    }

    // Para prácticas nacionales
    const capituloNum = Number(String(item.capitulo ?? '').replace(/\D/g, '')) || 0;
    const capituloNombre = item.capituloNombre ?? '';
    const esCapitulo34 = normalize(capituloNombre).includes('radiologia') ||
                         normalize(capituloNombre).includes('diagnostico por imagenes');
    const esCap12o13 = capituloNum === 12 || capituloNum === 13;

    if (esCapitulo34) {
      const gastoOp = (valoresConvenio.gastoRx * item.gto) / 2;
      const honorario = valoresConvenio.galenoRx * item.qgal + gastoOp;
      return honorario + gastoOp;
    }

    if (esCap12o13) {
      const honorario = valoresConvenio.galenoQuir * item.qgal;
      const gasto = valoresConvenio.gastoOperatorio * item.gto;
      return honorario + gasto;
    }

    // Para otras prácticas
    return valoresConvenio.otrosGastos * (item.qgal + item.gto);
  };

  /* === AGREGAR PRÁCTICA === */
  const handleAgregar = (practica) => {
    const valor = calcularValorPractica(practica);
    const nuevaPractica = {
      id: `pract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...practica,
      valorCalculado: valor,
      total: valor,
      cantidad: 1,
      esModulada: practica.tipo === 'modulada',
      valoresUsados: { ...valoresConvenio }
    };
    agregarPractica(nuevaPractica);
  };

  /* === RENDERIZAR ITEM === */
  const renderItem = (item, isMobile = false, queryLocal = '') => {
    const valor = calcularValorPractica(item);
    const esRX = isRadiografia(item);
    const esModulada = item.tipo === 'modulada';
    const esSubs = isSubsiguiente(item);

    if (isMobile) {
      return (
        <article
          key={item.__key || item.codigo}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''} ${esModulada ? styles.moduladaCard : ''}`}
        >
          <div className={styles.cardTop}>
            <div className={styles.code}>{highlight(item.codigo, queryLocal || query)}</div>
            <span className={`${styles.capBadge} ${esModulada ? styles.moduladaBadge : ''}`}>
              {item.capitulo} – {item.capituloNombre}
            </span>
          </div>

          <div className={styles.desc}>{highlight(item.descripcion, queryLocal || query)}</div>

          <div className={styles.costGrid}>
            {esModulada ? (
              <div className={styles.costBox}>
                <span className={styles.costLabel}>VALOR</span>
                <span className={`${styles.costValue} ${styles.moduladaValue}`}>
                  ${money(valor)}
                </span>
              </div>
            ) : (
              <>
                <div className={styles.costBox}>
                  <span className={styles.costLabel}>GAL</span>
                  <span className={styles.costValue}>{money(item.qgal || 0)}</span>
                  {esRX && (
                    <span className={styles.subValue}>
                      ${money(valoresConvenio.galenoRx * item.qgal)}
                    </span>
                  )}
                </div>

                <div className={styles.costBox}>
                  <span className={styles.costLabel}>GTO</span>
                  <span className={styles.costValue}>{money(item.gto || 0)}</span>
                  {esRX && (
                    <span className={styles.subValue}>
                      ${money((valoresConvenio.gastoRx * item.gto) / 2)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.cardActions}>
            <button
              onClick={() => handleAgregar(item)}
              className={`${styles.btnAgregar} ${esModulada ? styles.btnModulada : ''}`}
              title="Agregar a factura"
            >
              ➕ Agregar (${money(valor)})
            </button>
          </div>
        </article>
      );
    }

    // Desktop table row
    return (
      <tr
        key={item.__key || item.codigo}
        className={`${esRX ? styles.rxRow : ''} ${esSubs ? styles.subsiguienteRow : ''} ${esModulada ? styles.moduladaRow : ''}`}
      >
        <td>
          {highlight(item.codigo, queryLocal || query)}
          {esModulada && <span className={styles.badgeModulada}>M</span>}
        </td>
        <td className={styles.descCell}>
          {highlight(item.descripcion, queryLocal || query)}
        </td>
        <td>
          <span className={`${styles.capBadge} ${esModulada ? styles.moduladaBadge : ''}`}>
            {item.capitulo} – {item.capituloNombre}
          </span>
        </td>
        {esModulada ? (
          <>
            <td className={styles.numeric}>—</td>
            <td className={styles.numeric}>—</td>
          </>
        ) : (
          <>
            <td className={styles.numeric}>{money(item.qgal || 0)}</td>
            <td className={styles.numeric}>{money(item.gto || 0)}</td>
          </>
        )}
        <td className={styles.numeric}>
          <strong>${money(valor)}</strong>
          {esModulada ? (
            <div className={styles.formulaPequeña}>Valor fijo</div>
          ) : esRX ? (
            <div className={styles.formulaPequeña}>
              GAL × ${money(valoresConvenio.galenoRx)} + GTO × ${money(valoresConvenio.gastoRx)}/2
            </div>
          ) : null}
        </td>
        <td>
          <button
            onClick={() => handleAgregar(item)}
            className={`${styles.btnAgregarTabla} ${esModulada ? styles.btnModulada : ''}`}
            title="Agregar a factura"
          >
            ➕
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.tabContent}>
      <h2>🏥 Prácticas Médicas</h2>

      {/* Valores del convenio */}
      <div className={styles.valoresConvenio}>
        <div className={styles.valorItem}>
          <span>Galeno Rx:</span>
          <strong>${money(valoresConvenio.galenoRx)}</strong>
        </div>
        <div className={styles.valorItem}>
          <span>Gasto Rx:</span>
          <strong>${money(valoresConvenio.gastoRx)}</strong>
        </div>
        <div className={styles.valorItem}>
          <span>Galeno Quir:</span>
          <strong>${money(valoresConvenio.galenoQuir)}</strong>
        </div>
        <div className={styles.valorItem}>
          <span>Gasto Op:</span>
          <strong>${money(valoresConvenio.gastoOperatorio)}</strong>
        </div>
        <div className={styles.valorItem}>
          <span>Otros gastos:</span>
          <strong>${money(valoresConvenio.otrosGastos)}</strong>
        </div>
      </div>

      {/* Info prácticas moduladas */}
      <div className={styles.infoBox}>
        <h3>📋 Prácticas Moduladas</h3>
        <p>Estas prácticas tienen valores fijos y no dependen de GAL/GTO.</p>
      </div>

      {/* Modo búsqueda/exploración */}
      <div className={styles.modoContainer}>
        <button 
          className={`${styles.modoButton} ${modoBusqueda ? styles.modoActive : ''}`}
          onClick={() => setModoBusqueda(true)}
        >
          🔍 Búsqueda global
        </button>
        <button 
          className={`${styles.modoButton} ${!modoBusqueda ? styles.modoActive : ''}`}
          onClick={() => setModoBusqueda(false)}
        >
          📂 Explorar por capítulos
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <p>Cargando prácticas...</p>
        </div>
      ) : modoBusqueda ? (
        <>
          {/* Buscador global */}
          <div className={styles.buscadorContainer}>
            <input
              type="text"
              placeholder="Buscar práctica por código o descripción..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.buscadorInput}
              autoComplete="off"
              spellCheck={false}
            />
            <div className={styles.buscadorInfo}>
              {resultadosGlobales.length} prácticas encontradas
              {query && ` para "${query}"`}
            </div>
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>
                {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
              </div>
            ) : (
              resultadosGlobales.map((item) => renderItem(item, true))
            )}
          </div>

          {/* Desktop table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Capítulo</th>
                  <th className={styles.numeric}>GAL</th>
                  <th className={styles.numeric}>GTO</th>
                  <th className={styles.numeric}>Valor</th>
                  <th>Agregar</th>
                </tr>
              </thead>
              <tbody>
                {resultadosGlobales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.noResultsCell}>
                      {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
                    </td>
                  </tr>
                ) : (
                  resultadosGlobales.map((item) => renderItem(item, false))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Buscador por capítulos */}
          <input
            type="text"
            placeholder="Buscar capítulo..."
            value={filtroCapitulo}
            onChange={(e) => setFiltroCapitulo(e.target.value)}
            className={styles.buscadorInput}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Lista de capítulos */}
          {capitulos
            .filter((c) => {
              if (!filtroCapitulo) return true;
              const q = filtroCapitulo.toLowerCase();
              return (
                String(c.descripcion ?? '').toLowerCase().includes(q) ||
                String(c.capitulo ?? '').includes(filtroCapitulo)
              );
            })
            .map((c) => {
              const practicas = data.filter(p => p.capitulo === c.capitulo && p.tipo === 'nacional');
              const qLocal = capituloQueries[c.capitulo] || '';
              const qLocalNorm = normalize(qLocal);

              const practicasFiltradas =
                qLocal.trim().length === 0
                  ? practicas
                  : practicas.filter((p) => normalize(`${p.codigo} ${p.descripcion}`).includes(qLocalNorm));

              return (
                <details key={String(c.capitulo)} className={styles.accordion}>
                  <summary className={styles.accordionHeader}>
                    {c.capitulo} — {c.descripcion} ({practicasFiltradas.length})
                  </summary>

                  <div className={styles.accordionBody}>
                    <input
                      type="text"
                      placeholder={`Buscar en ${c.descripcion}…`}
                      value={qLocal}
                      onChange={(e) =>
                        setCapituloQueries((prev) => ({
                          ...prev,
                          [c.capitulo]: e.target.value,
                        }))
                      }
                      className={styles.buscadorInput}
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {/* Mobile cards */}
                    <div className={styles.mobileList}>
                      {practicasFiltradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados en este capítulo.</div>
                      ) : (
                        practicasFiltradas.map((item) => renderItem(item, true, qLocal))
                      )}
                    </div>

                    {/* Desktop table */}
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th className={styles.numeric}>GAL</th>
                            <th className={styles.numeric}>GTO</th>
                            <th className={styles.numeric}>Valor</th>
                            <th>Agregar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={6} className={styles.noResultsCell}>
                                Sin resultados en este capítulo.
                              </td>
                            </tr>
                          ) : (
                            practicasFiltradas.map((item) => renderItem(item, false, qLocal))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })}

          {/* Sección de prácticas moduladas al final */}
          <details className={styles.accordion} open>
            <summary className={`${styles.accordionHeader} ${styles.moduladaHeader}`}>
              MOD — Prácticas Moduladas ({PRACTICAS_MODULADAS.length})
            </summary>

            <div className={styles.accordionBody}>
              {/* Mobile cards */}
              <div className={styles.mobileList}>
                {PRACTICAS_MODULADAS.map((item) => renderItem(item, true))}
              </div>

              {/* Desktop table */}
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th className={styles.numeric}>GAL</th>
                      <th className={styles.numeric}>GTO</th>
                      <th className={styles.numeric}>Valor</th>
                      <th>Agregar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRACTICAS_MODULADAS.map((item) => renderItem(item, false))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </>
      )}

      {/* Navegación */}
      <div className={styles.botonesNavegacion}>
        <button 
          className={styles.btnAtras}
          onClick={onAtras}
        >
          ← Atrás
        </button>
        <button 
          className={styles.btnSiguiente}
          onClick={onSiguiente}
        >
          Siguiente → Laboratorios
        </button>
      </div>
    </div>
  );
}
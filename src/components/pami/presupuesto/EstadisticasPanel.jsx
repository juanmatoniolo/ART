"use client";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import { calcularEstadisticas } from "@/lib/pami/presupuestos";
import OncoplanBadge from "./OncoplanBadge";
import styles from "./presupuesto.module.css";

const fechaISO = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
};

export default function EstadisticasPanel({ pacientesDb }) {
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState("todos");
    const [filtroOncoplan, setFiltroOncoplan] = useState("todos");
    const [edadDesde, setEdadDesde] = useState("");
    const [edadHasta, setEdadHasta] = useState("");
    const [periodoActivo, setPeriodoActivo] = useState("todo");

    const estadisticas = useMemo(
        () => calcularEstadisticas(pacientesDb, { desde, hasta, edadDesde, edadHasta, filtroCategoria, filtroOncoplan }),
        [pacientesDb, desde, hasta, edadDesde, edadHasta, filtroCategoria, filtroOncoplan]
    );

    const aplicarPeriodo = (periodo) => {
        const hoy = new Date();
        const inicio = new Date(hoy);
        if (periodo === "mes") inicio.setDate(1);
        else if (periodo === "30") inicio.setDate(hoy.getDate() - 29);
        else if (periodo === "90") inicio.setDate(hoy.getDate() - 89);
        else if (periodo === "anio") inicio.setMonth(0, 1);
        setDesde(fechaISO(inicio));
        setHasta(fechaISO(hoy));
    };

    return (
        <section className={styles.colMain}>
            <div className={styles.card}>
                <div className={styles.statsHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>Resumen de actividad</h3>
                        <p className={styles.hint}>
                            Visualizá los principales indicadores. Ajustá el período si lo necesitás.
                        </p>
                    </div>
                    <span className={styles.dataNote}>Importes presupuestados</span>
                </div>

                <div className={styles.periodButtons} aria-label="Filtrar período">
                    {[
                        ["todo", "Todo"],
                        ["mes", "Este mes"],
                        ["30", "Últimos 30 días"],
                        ["90", "Últimos 90 días"],
                        ["anio", "Este año"],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`${styles.periodButton} ${periodoActivo === id ? styles.periodButtonActive : ""}`}
                            aria-pressed={periodoActivo === id}
                            onClick={() => {
                                setPeriodoActivo(id);
                                if (id === "todo") { setDesde(""); setHasta(""); }
                                else aplicarPeriodo(id);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <details className={styles.advancedFilters}>
                    <summary>Filtros avanzados <span>Fechas exactas, categoría, modalidad y edad</span></summary>
                    <div className={styles.filters}>
                        <label className={styles.field}>
                            <span>Desde</span>
                            <input className={styles.input} type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPeriodoActivo("personalizado"); }} />
                        </label>
                        <label className={styles.field}>
                            <span>Hasta</span>
                            <input className={styles.input} type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPeriodoActivo("personalizado"); }} />
                        </label>
                        <label className={styles.field}>
                            <span>Tipo de insumo</span>
                            <select className={styles.input} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                                <option value="todos">Todos</option>
                                <option value="medicamentos">Medicamentos</option>
                                <option value="descartables">Descartables</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span>Modalidad PAMI</span>
                            <select className={styles.input} value={filtroOncoplan} onChange={(e) => setFiltroOncoplan(e.target.value)}>
                                <option value="todos">Todas</option>
                                <option value="oncoplan">Oncoplan (cáncer)</option>
                                <option value="normal">PAMI normal</option>
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span>Edad mínima</span>
                            <input className={styles.input} type="number" min="0" max="120" placeholder="Sin mínimo" value={edadDesde} onChange={(e) => setEdadDesde(e.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span>Edad máxima</span>
                            <input className={styles.input} type="number" min="0" max="120" placeholder="Sin máximo" value={edadHasta} onChange={(e) => setEdadHasta(e.target.value)} />
                        </label>
                        <button
                            type="button"
                            className={styles.btn}
                            onClick={() => {
                                setDesde(""); setHasta(""); setFiltroCategoria("todos");
                                setFiltroOncoplan("todos"); setEdadDesde(""); setEdadHasta("");
                                setPeriodoActivo("todo");
                            }}
                        >
                            Restablecer filtros
                        </button>
                    </div>
                </details>

                <div className={styles.kpiGrid}>
                    <article className={styles.kpi}><span>Total presupuestado</span><strong>{formatCurrency(estadisticas.total)}</strong></article>
                    <article className={styles.kpi}><span>Medicamentos</span><strong>{formatCurrency(estadisticas.medicamentos)}</strong></article>
                    <article className={styles.kpi}><span>Descartables</span><strong>{formatCurrency(estadisticas.descartables)}</strong></article>
                    <article className={styles.kpi}><span>Promedio por paciente</span><strong>{formatCurrency(estadisticas.promedio)}</strong></article>
                    <article className={styles.kpi}><span>Pacientes con presupuestos</span><strong>{estadisticas.pacientesUnicos}</strong></article>
                    <article className={styles.kpi}><span>Unidades presupuestadas</span><strong>{estadisticas.unidades}</strong></article>
                    <article className={styles.kpi}>
                        <span>Oncoplan <OncoplanBadge small /></span>
                        <strong>{estadisticas.oncoplanCount} · {formatCurrency(estadisticas.oncoplanTotal)}</strong>
                    </article>
                    <article className={styles.kpi}>
                        <span>PAMI normal</span>
                        <strong>{estadisticas.normalCount} · {formatCurrency(estadisticas.normalTotal)}</strong>
                    </article>
                </div>
            </div>

            <div className={styles.card}>
                <h3 className={styles.cardTitle}>Insumos más utilizados</h3>
                {estadisticas.top.length === 0 ? (
                    <p className={styles.empty}>No hay datos para los filtros seleccionados.</p>
                ) : (
                    <div className={styles.statsList}>
                        {estadisticas.top.map((i) => (
                            <div className={styles.statRow} key={i.nombre}>
                                <div>
                                    <strong>{i.nombre}</strong>
                                    <small>{i.cantidad} unidades · {formatCurrency(i.total)}</small>
                                </div>
                                <div className={styles.barTrack}>
                                    <span style={{ width: `${Math.max(3, (i.cantidad / estadisticas.top[0].cantidad) * 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.card}>
                <h3 className={styles.cardTitle}>Evolución mensual</h3>
                {estadisticas.porMes.length === 0 ? (
                    <p className={styles.empty}>No hay fechas disponibles para graficar.</p>
                ) : (
                    <div className={styles.statsList}>
                        {estadisticas.porMes.map(([mes, monto]) => (
                            <div className={styles.statRow} key={mes}>
                                <strong>{mes}</strong>
                                <div className={styles.barTrack}>
                                    <span style={{ width: `${Math.max(2, (monto / Math.max(...estadisticas.porMes.map((x) => x[1]))) * 100)}%` }} />
                                </div>
                                <strong>{formatCurrency(monto)}</strong>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
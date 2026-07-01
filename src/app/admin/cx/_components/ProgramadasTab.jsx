import { useMemo } from "react";
import styles from "../cx-common.module.css";
import StatsBar from "./StatsBar";
import CirugiaCard from "./CirugiaCard";
import {
  getDoctor,
  preopStatus,
  formatNumberWithThousands,
  fmtDateTime,
  downloadCxPdf,
} from "../_utils/helpers";
import { DOCTORES } from "../_utils/helpers";

export default function ProgramadasTab({
  cirugias,
  search,
  setSearch,
  filterFechaDesde,
  setFilterFechaDesde,
  filterFechaHasta,
  setFilterFechaHasta,
  filterDoctor,
  setFilterDoctor,
  filterSoloIncompleto,
  setFilterSoloIncompleto,
  onRealizar,
  onEditar,
  onEliminar,
  onVerFicha,
  onEstudioClick,
  mapping,
  canonical,
}) {
  const applyFilters = (list) => {
    return list.filter((cx) => {
      const dr = getDoctor(cx);
      const full =
        `${cx.pacienteDatos?.apellido || ""} ${cx.pacienteDatos?.nombre || ""} ${cx.pacienteDatos?.dni || ""} ${cx.formulario?.cx || ""}`.toLowerCase();
      if (search && !full.includes(search.toLowerCase())) return false;
      if (filterDoctor && dr !== filterDoctor) return false;
      if (filterSoloIncompleto && preopStatus(cx).completo) return false;
      return true;
    });
  };

  const cirugiasPendientes = useMemo(() => {
    let list = cirugias.filter((cx) => !cx.realizada);
    list = list.filter((cx) => {
      if (!cx.fechaEstimada) return false;
      if (filterFechaDesde && cx.fechaEstimada < filterFechaDesde) return false;
      if (filterFechaHasta && cx.fechaEstimada > filterFechaHasta) return false;
      return true;
    });
    list = applyFilters(list);
    list.sort((a, b) => a.fechaEstimada.localeCompare(b.fechaEstimada));
    return list;
  }, [cirugias, search, filterDoctor, filterFechaDesde, filterFechaHasta, filterSoloIncompleto]);

  const cirugiasRealizadas = useMemo(() => {
    let list = cirugias.filter((cx) => cx.realizada);
    list = list.filter((cx) => {
      if (!cx.fechaRealizacion) return false;
      const fecha = cx.fechaRealizacion.slice(0, 10);
      if (filterFechaDesde && fecha < filterFechaDesde) return false;
      if (filterFechaHasta && fecha > filterFechaHasta) return false;
      return true;
    });
    list = applyFilters(list);
    list.sort((a, b) => (b.fechaRealizacion || "").localeCompare(a.fechaRealizacion || ""));
    return list;
  }, [cirugias, search, filterDoctor, filterFechaDesde, filterFechaHasta, filterSoloIncompleto]);

  const limpiarFiltros = () => {
    setSearch("");
    setFilterFechaDesde("");
    setFilterFechaHasta("");
    setFilterDoctor("");
    setFilterSoloIncompleto(false);
  };

  return (
    <>
      <StatsBar cirugias={cirugias} />

      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por paciente, DNI o cirugía…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>
        <div className={styles.filterRow}>
          <label className={styles.filterLabel}>
            Desde
            <input
              type="date"
              className={styles.filterInput}
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
            />
          </label>
          <label className={styles.filterLabel}>
            Hasta
            <input
              type="date"
              className={styles.filterInput}
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
            />
          </label>
          <label className={styles.filterLabel}>
            Médico
            <select
              className={styles.filterInput}
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
            >
              <option value="">Todos</option>
              {DOCTORES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterCheckLabel}>
            <input
              type="checkbox"
              checked={filterSoloIncompleto}
              onChange={(e) => setFilterSoloIncompleto(e.target.checked)}
            />
            Solo preop incompleto
          </label>
          <button className={styles.clearBtn} onClick={limpiarFiltros}>
            Limpiar
          </button>
        </div>
      </div>

      {cirugiasPendientes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <p>No hay cirugías programadas con los filtros aplicados.</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {cirugiasPendientes.map((cx) => (
            <CirugiaCard
              key={cx.id}
              cx={cx}
              onRealizar={(c) => onRealizar(c)}
              onEditar={(c) => onEditar(c)}
              onEliminar={onEliminar}
              onVerFicha={(c) => onVerFicha(c)}
              onEstudioClick={(c, tipo) => onEstudioClick(c, tipo)}
              onDownloadFrente={(c) => downloadCxPdf(c, "Frente", mapping, canonical)}
            />
          ))}
        </div>
      )}

      {cirugiasRealizadas.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ color: "#94a3b8", marginBottom: "1rem" }}>Historial reciente</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Cirugía</th>
                  <th>Médico</th>
                  <th>Realizada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cirugiasRealizadas.slice(0, 10).map((cx) => (
                  <tr key={cx.id}>
                    <td>
                      <strong>
                        {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                      </strong>
                      {cx.pacienteDatos?.dni && (
                        <div className={styles.dniSmall}>
                          DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}
                        </div>
                      )}
                    </td>
                    <td>{cx.formulario?.cx || "—"}</td>
                    <td>{getDoctor(cx) || "—"}</td>
                    <td>{fmtDateTime(cx.fechaRealizacion)}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          className={styles.actionView}
                          onClick={() => onVerFicha(cx)}
                        >
                          📋
                        </button>
                        <button
                          className={styles.actionDelete}
                          onClick={() => onEliminar(cx.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
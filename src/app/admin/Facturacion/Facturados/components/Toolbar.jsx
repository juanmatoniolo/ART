// src/app/admin/Facturacion/Facturados/components/Toolbar.jsx
import styles from './toolbar.module.css';
import { prettyLabel } from '../../utils/calculos';

export default function Toolbar({
  q,
  onSearchChange,
  art,
  onArtChange,
  arts,
  orden,
  onOrdenChange,
  selectedCount,
  totalFiltered,
  onToggleSelectAll,
  fechaDesde,
  onFechaDesdeChange,
  fechaHasta,
  onFechaHastaChange,
}) {
  return (
    <div className={styles.toolbar}>

      {/* ── Búsqueda ── */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className={styles.search}
          placeholder="Buscar paciente, DNI, siniestro, ART…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filtersRow}>
        <div className={styles.filterGroup}>

          {/* ART */}
          <div className={styles.selectWrap}>
            <select className={styles.sel} value={art} onChange={(e) => onArtChange(e.target.value)}>
              <option value="">Todas las ART</option>
              {arts.map((a) => (
                <option key={a.key} value={a.key}>{prettyLabel(a.name)}</option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {/* Orden */}
          <div className={styles.selectWrap}>
            <select className={styles.sel} value={orden} onChange={(e) => onOrdenChange(e.target.value)}>
              <option value="fecha_desc">Fecha ↓ reciente</option>
              <option value="fecha_asc">Fecha ↑ antiguo</option>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="nombre_desc">Nombre Z-A</option>
              <option value="total_desc">Total ↓ mayor</option>
              <option value="total_asc">Total ↑ menor</option>
              <option value="estado_cerrado">Primero cerrados</option>
              <option value="estado_borrador">Primero borradores</option>
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {/* Rango de fechas */}
          <div className={styles.dateRange}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <input
              type="date"
              className={styles.dateInput}
              value={fechaDesde}
              onChange={(e) => onFechaDesdeChange(e.target.value)}
            />
            <span className={styles.dateSep}>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={fechaHasta}
              onChange={(e) => onFechaHastaChange(e.target.value)}
            />
          </div>

          {/* Seleccionar todos */}
          <label className={styles.chkAll}>
            <input
              type="checkbox"
              checked={selectedCount === totalFiltered && totalFiltered > 0}
              onChange={onToggleSelectAll}
            />
            Seleccionar todos
          </label>

        </div>

        {/* Contador de resultados */}
        <span className={styles.resultsLabel}>
          Mostrando <strong>{totalFiltered}</strong> registros
        </span>
      </div>

    </div>
  );
}
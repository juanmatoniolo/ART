import styles from '../facturados.module.css';
import { prettyLabel } from '../../utils/calculos';

export default function Toolbar({
  q,
  onSearchChange,
  estado,
  onEstadoChange,
  art,
  onArtChange,
  arts,
  orden,
  onOrdenChange,
  selectedCount,
  totalFiltered,
  onToggleSelectAll,
  // 👇 NUEVAS PROPS
  fechaDesde,
  onFechaDesdeChange,
  fechaHasta,
  onFechaHastaChange,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.searchBlock}>
        <input
          className={styles.search}
          placeholder="Buscar paciente, DNI, siniestro, ART..."
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.filters}>
        {/* Filtros existentes */}
        <select className={styles.select} value={estado} onChange={(e) => onEstadoChange(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="cerrado">Cerrados</option>
          <option value="borrador">Borradores</option>
        </select>

        <select className={styles.select} value={art} onChange={(e) => onArtChange(e.target.value)}>
          <option value="">Todas las ART</option>
          {arts.map(a => (
            <option key={a.key} value={a.key}>{prettyLabel(a.name)}</option>
          ))}
        </select>

        <select className={styles.select} value={orden} onChange={(e) => onOrdenChange(e.target.value)}>
          <option value="fecha_desc">Fecha ↓ (reciente)</option>
          <option value="fecha_asc">Fecha ↑ (antiguo)</option>
          <option value="nombre_asc">Nombre ↑ (A-Z)</option>
          <option value="nombre_desc">Nombre ↓ (Z-A)</option>
          <option value="total_desc">Total ↓ (mayor)</option>
          <option value="total_asc">Total ↑ (menor)</option>
          <option value="estado_cerrado">Primero cerrados</option>
          <option value="estado_borrador">Primero borradores</option>
        </select>

        {/* 👇 NUEVOS FILTROS DE FECHA */}
        <div className={styles.dateRange}>
          <input
            type="date"
            className={styles.dateInput}
            value={fechaDesde}
            onChange={(e) => onFechaDesdeChange(e.target.value)}
            placeholder="Desde"
          />
          <span className={styles.dateSeparator}>a</span>
          <input
            type="date"
            className={styles.dateInput}
            value={fechaHasta}
            onChange={(e) => onFechaHastaChange(e.target.value)}
            placeholder="Hasta"
          />
        </div>

        <label className={styles.checkboxAll}>
          <input
            type="checkbox"
            checked={selectedCount === totalFiltered && totalFiltered > 0}
            onChange={onToggleSelectAll}
          />
          <span>Seleccionar todos</span>
        </label>
      </div>
    </div>
  );
}
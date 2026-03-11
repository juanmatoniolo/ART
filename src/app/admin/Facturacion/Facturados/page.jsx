// src/app/admin/Facturacion/Facturados/page.jsx
'use client';

import useFacturados from './Hook/useFacturados';
import Header from './components/Header';
import QuickSwitch from './components/QuickSwitch';
import Toolbar from './components/Toolbar';
import ItemCard from './components/ItemCard';
import styles from './facturados.module.css';

export default function FacturadosPage() {


  const {
  loading,
  q,
  setQ,
  estado,
  setEstadoQuery,
  art,
  setArt,
  orden,
  setOrden,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  deleting,
  deleteSelected,
  exportCompleto,
  printART,
  counts,
  arts,
  filtered,
  fechaDesde,        // 👈 Agregar
  setFechaDesde,     // 👈 Agregar
  fechaHasta,        // 👈 Agregar
  setFechaHasta,     // 👈 Agregar
} = useFacturados();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Header
          selectedCount={selectedIds.size}
          onExport={exportCompleto}
          onDelete={deleteSelected}
          deleting={deleting}
        />
        <QuickSwitch estado={estado} counts={counts} onSwitch={setEstadoQuery} />
        <Toolbar
          q={q}
          onSearchChange={setQ}
          estado={estado}
          onEstadoChange={setEstadoQuery}
          art={art}
          onArtChange={setArt}
          arts={arts}
          orden={orden}
          onOrdenChange={setOrden}
          selectedCount={selectedIds.size}
          totalFiltered={filtered.length}
          onToggleSelectAll={toggleSelectAll}
          // 👇 NUEVAS PROPS
          fechaDesde={fechaDesde}
          onFechaDesdeChange={setFechaDesde}
          fechaHasta={fechaHasta}
          onFechaHastaChange={setFechaHasta}
        />
      </header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay resultados con esos filtros.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(it => (
              <ItemCard
                key={it.id}
                item={it}
                isSelected={selectedIds.has(it.id)}
                onToggleSelect={toggleSelect}
                onPrintART={printART}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
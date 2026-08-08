"use client";
import React, { useState, useEffect } from 'react';
import getArtImage from '../lib/artImages';
import styles from '../page.module.css';

const grupos = {
  iaps: {
    nombres: ['IAPS AP', 'IAPS', 'IAPSER SEGUROS', 'IAPS ART'],
    color: '#3b82f6',
    label: 'IAPS',
  },
  lasegunda: {
    nombres: ['La Segunda AP', 'La Segunda ART'],
    color: '#22c55e',
    label: 'La Segunda',
  },
  federacion: {
    nombres: ['Fed. Patronal ART', 'Fed. Patronal AP', 'Federación Patronal'],
    color: '#f97316',
    label: 'Fed. Patronal',
  },
  asociart: {
    nombres: ['ASOCIART'],
    color: '#ef4444',
    label: 'ASOCIART',
  },
  medicalwork: {
    nombres: ['Medical Work'],
    color: '#06b6d4',
    label: 'Medical Work',
  },
  comfye: {
    nombres: ['CONFYE'],
    color: '#eab308',
    label: 'CONFYE',
  },
  victoria: {
    nombres: ['Victoria Seguros'],
    color: '#8b5cf6',
    label: 'Victoria',
  },
  reconquista: {
    nombres: ['Reconquista ART'],
    color: '#6b7280',
    label: 'Reconquista',
  },
};

const getGrupo = (nombre) => {
  const lower = nombre.toLowerCase();
  for (const [key, grupo] of Object.entries(grupos)) {
    if (grupo.nombres.some(n => lower.includes(n.toLowerCase()))) {
      return grupo;
    }
  }
  return null;
};

export default function PasoArtes({
  arts = [],
  loading = false,
  selectedArts,
  toggleArt,
  toggleAllArts,
  onManageArts,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [modoEditarOrden, setModoEditarOrden] = useState(false);
  // Estado para el orden personalizado (array de IDs)
  const [orden, setOrden] = useState([]);

  // Cargar orden guardado desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem('ordenArtes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrden(parsed);
        }
      } catch (e) {}
    }
  }, []);

  // Función para obtener la lista de ARTs en el orden actual (personalizado o por defecto)
  const getArtsOrdenadas = () => {
    if (orden.length > 0) {
      // Filtrar solo los arts que existen y ordenar según el array de IDs
      const ordenados = orden
        .map(id => arts.find(a => a.id === id))
        .filter(Boolean);
      // Añadir los arts que no estén en el orden personalizado al final
      const restantes = arts.filter(a => !orden.includes(a.id));
      return [...ordenados, ...restantes];
    }
    return arts; // sin orden personalizado, usamos el original
  };

  const artsOrdenadas = getArtsOrdenadas();

  // Filtrar por búsqueda sobre las ordenadas
  const artsFiltradas = artsOrdenadas.filter(art =>
    art.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const todasSeleccionadas = artsFiltradas.length > 0 && artsFiltradas.every(art => selectedArts.has(art.id));

  // --- Drag & Drop handlers ---
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // necesario para permitir soltar
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === targetId) return;

    // Obtener el array de IDs actual (de las filtradas, porque solo movemos entre visibles)
    const idsActuales = artsFiltradas.map(a => a.id);
    const indexDragged = idsActuales.indexOf(draggedId);
    const indexTarget = idsActuales.indexOf(targetId);
    if (indexDragged === -1 || indexTarget === -1) return;

    // Reordenar el array de IDs
    const newIds = [...idsActuales];
    newIds.splice(indexDragged, 1);
    newIds.splice(indexTarget, 0, draggedId);

    // Actualizar el estado 'orden' con los nuevos IDs (reemplazando los que estaban en el orden personalizado)
    // Pero ojo: 'orden' contiene todos los IDs, no solo los filtrados.
    // Mejor reconstruir el orden completo: mantener el orden de los filtrados y añadir el resto al final.
    const ordenCompleto = [...newIds];
    // Añadir los IDs que no están en el filtro (los no visibles) al final, manteniendo su orden relativo
    const idsNoFiltrados = arts.map(a => a.id).filter(id => !idsActuales.includes(id));
    ordenCompleto.push(...idsNoFiltrados);
    setOrden(ordenCompleto);
  };

  // Guardar orden en localStorage
  const guardarOrden = () => {
    localStorage.setItem('ordenArtes', JSON.stringify(orden));
    setModoEditarOrden(false);
    // Opcional: notificar al usuario
    alert('Orden guardado correctamente');
  };

  // Cancelar edición (volver al orden guardado o al original)
  const cancelarEdicion = () => {
    const saved = localStorage.getItem('ordenArtes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setOrden(parsed);
      } catch (e) {}
    } else {
      setOrden([]); // vacío para usar el orden original
    }
    setModoEditarOrden(false);
  };

  return (
    <div className={styles.block}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>🏢 ARTs</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={styles.tinyBtn} onClick={onManageArts}>⚙️ Gestionar</button>
          <button
            className={styles.tinyBtn}
            onClick={() => setModoEditarOrden(!modoEditarOrden)}
          >
            {modoEditarOrden ? '🔒 Cancelar' : '✏️ Editar orden'}
          </button>
          {modoEditarOrden && (
            <>
              <button className={styles.tinyBtn} onClick={guardarOrden} style={{ background: '#22c55e', color: 'white' }}>
                💾 Guardar
              </button>
              <button className={styles.tinyBtn} onClick={cancelarEdicion}>
                ❌ Cancelar
              </button>
            </>
          )}
          <button
            className={styles.tinyBtn}
            onClick={() => toggleAllArts(!todasSeleccionadas)}
            disabled={artsFiltradas.length === 0}
          >
            {todasSeleccionadas ? '❌ Quitar todas' : '✅ Todas'}
          </button>
        </div>
      </div>

      <div className={styles.atajosFilter}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar ART..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {modoEditarOrden && (
          <span style={{ color: '#fbbf24', fontSize: '12px', marginLeft: '8px' }}>
            🔄 Arrastra las tarjetas para reordenar
          </span>
        )}
      </div>

      {loading ? (
        <p className={styles.emptyMsg}>Cargando ARTs...</p>
      ) : artsFiltradas.length === 0 ? (
        <p className={styles.emptyMsg}>No hay ARTs disponibles</p>
      ) : (
        <div className={styles.artsGrid}>
          {artsFiltradas.map((art) => {
            const isSelected = selectedArts.has(art.id);
            const logoUrl = getArtImage(art.nombre);
            const grupo = getGrupo(art.nombre);
            const color = grupo ? grupo.color : '#6b7280';

            return (
              <div
                key={art.id}
                className={`${styles.artCard} ${isSelected ? styles.artCardSelected : ''} ${styles.artCardGroup}`}
                style={{
                  '--grupo-color': color,
                  borderColor: isSelected ? color : 'transparent',
                  cursor: modoEditarOrden ? 'grab' : 'pointer',
                  opacity: modoEditarOrden ? 0.9 : 1,
                }}
                draggable={modoEditarOrden}
                onDragStart={(e) => handleDragStart(e, art.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, art.id)}
                onClick={() => {
                  if (!modoEditarOrden) toggleArt(art.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !modoEditarOrden) {
                    toggleArt(art.id);
                  }
                }}
              >
                <div className={styles.artLogoContainer}>
                  <img
                    src={logoUrl}
                    alt={`Logo ${art.nombre}`}
                    className={styles.artLogo}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/img-art/default.webp';
                    }}
                  />
                </div>
                <div className={styles.artNameContainer}>
                  <span className={styles.artName}>{art.nombre}</span>
                  {isSelected && <span className={styles.checkIcon}>✓</span>}
                </div>
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
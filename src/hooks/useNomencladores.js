import { useEffect, useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';

// Normalización para búsqueda
const normalize = (s) => (s || '')
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

// Opciones de Fuse
const FUSE_OPTIONS = {
  keys: [
    { name: 'codigoNormalizado', weight: 0.65 },
    { name: 'descripcionNormalizada', weight: 0.3 },
    { name: 'region_nombre_norm', weight: 0.05 },
  ],
  threshold: 0.25,
  distance: 200,
  ignoreLocation: true,
  minMatchCharLength: 2,
  useExtendedSearch: false,
};

export function useNomencladores() {
  const [dataNacional, setDataNacional] = useState([]);
  const [dataAoter, setDataAoter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar ambos archivos
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch('/archivos/NomecladorNacional.json').then(res => res.json()),
      fetch('/archivos/Nomeclador_AOTER.json').then(res => res.json())
    ])
      .then(([nacional, aoter]) => {
        if (!mounted) return;

        // Procesar nacional (similar a antes)
        const nacionalFlat = [];
        const counts = new Map();
        if (Array.isArray(nacional)) {
          nacional.forEach(cap => {
            (cap.practicas || []).forEach(p => {
              const capStr = String(cap.capitulo ?? '').trim();
              const cod = String(p.codigo ?? '').trim();
              const base = `${capStr}|${cod}`;
              const n = (counts.get(base) ?? 0) + 1;
              counts.set(base, n);
              nacionalFlat.push({
                ...p,
                origen: 'nacional',
                capitulo: cap.capitulo,
                capituloNombre: cap.descripcion,
                __key: `${base}#${n}`,
                codigoNormalizado: normalize(cod),
                descripcionNormalizada: normalize(p.descripcion || ''),
              });
            });
          });
        }
        setDataNacional(nacionalFlat);

        // Procesar AOTER
        const aoterFlat = [];
        if (aoter?.practicas && Array.isArray(aoter.practicas)) {
          aoter.practicas.forEach(prac => {
            const region = prac.region || '';
            const regionNombre = prac.region_nombre || '';
            const complejidad = prac.complejidad || '';
            (prac.practicas || []).forEach(p => {
              const cod = String(p.codigo || '').trim();
              aoterFlat.push({
                ...p,
                origen: 'aoter',
                region,
                region_nombre: regionNombre,
                complejidad,
                codigoNormalizado: normalize(cod),
                descripcionNormalizada: normalize(p.descripcion || ''),
                __key: `aoter-${region}-${complejidad}-${cod}-${Math.random().toString(36).substr(2, 5)}`, // clave única
              });
            });
          });
        }
        setDataAoter(aoterFlat);

        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando nomencladores:', err);
        setError('No se pudieron cargar los nomencladores.');
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  // Fusión de datos (podemos filtrar por origen si se desea)
  const allData = useMemo(() => {
    return [...dataNacional, ...dataAoter];
  }, [dataNacional, dataAoter]);

  // Índices Fuse por separado (para búsqueda más rápida)
  const fuseNacional = useMemo(() => {
    if (!dataNacional.length) return null;
    return new Fuse(dataNacional, FUSE_OPTIONS);
  }, [dataNacional]);

  const fuseAoter = useMemo(() => {
    if (!dataAoter.length) return null;
    return new Fuse(dataAoter, FUSE_OPTIONS);
  }, [dataAoter]);

  // Función de búsqueda optimizada
  const buscar = useCallback(
    (query, filtroOrigen = 'todos') => {
      if (!query.trim()) return [];

      const q = normalize(query);
      const resultados = [];

      // Búsqueda exacta primero
      const buscarEn = (arr, fuse) => {
        // Coincidencias exactas por código
        const exactas = arr.filter(item => item.codigoNormalizado === q);
        // Búsqueda difusa
        const fuzzy = fuse ? fuse.search(q).map(r => r.item) : [];
        // Combinar sin duplicados (por __key)
        const mapa = new Map();
        [...exactas, ...fuzzy].forEach(item => mapa.set(item.__key, item));
        return Array.from(mapa.values());
      };

      if (filtroOrigen === 'nacional' || filtroOrigen === 'todos') {
        resultados.push(...buscarEn(dataNacional, fuseNacional));
      }
      if (filtroOrigen === 'aoter' || filtroOrigen === 'todos') {
        resultados.push(...buscarEn(dataAoter, fuseAoter));
      }

      // Eliminar duplicados entre orígenes (si hay códigos iguales, improbable)
      const unicos = new Map();
      resultados.forEach(item => unicos.set(item.__key, item));
      return Array.from(unicos.values());
    },
    [dataNacional, dataAoter, fuseNacional, fuseAoter]
  );

  return { allData, buscar, loading, error };
}
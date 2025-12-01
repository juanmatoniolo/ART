"use client";

import { useEffect, useState } from "react";
import Fuse from "fuse.js";

export default function AOTER() {
  const [natData, setNatData] = useState([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [complexityFilter, setComplexityFilter] = useState("");

  // --- Cargar JSON AOTER ---
  useEffect(() => {
    fetch("/Nomeclador_AOTER.json")
      .then(res => res.json())
      .then(json => {
        const tempData = [];
        json.practicas.forEach(regionGroup => {
          regionGroup.practicas.forEach(prac => {
            tempData.push({
              codigo: prac.codigo,
              descripcion: prac.descripcion,
              complejidad: regionGroup.complejidad,
              region: regionGroup.region,
              region_nombre: regionGroup.region_nombre
            });
          });
        });
        setNatData(tempData);
      })
      .catch(err => console.error("Error al cargar JSON AOTER:", err));
  }, []);

  // --- Filtrado con búsqueda exacta y parcial en descripción ---
  const filterData = () => {
    if (!natData.length) return [];

    const lowerSearch = search.toLowerCase().trim();
    let filtered = natData;

    if (lowerSearch) {
      // Exacto en código
      let exactCodeMatches = filtered.filter(d => d.codigo.toLowerCase() === lowerSearch);
      // Coincidencias parciales con Fuse.js en descripción o código
      const fuse = new Fuse(filtered, { keys: ["codigo", "descripcion"], threshold: 0.3 });
      let partialMatches = fuse.search(search).map(r => r.item);
      // Eliminar duplicados
      partialMatches = partialMatches.filter(d => !exactCodeMatches.includes(d));
      filtered = [...exactCodeMatches, ...partialMatches];
    }

    if (regionFilter) filtered = filtered.filter(d => d.region === regionFilter);
    if (complexityFilter) filtered = filtered.filter(d => d.complejidad === Number(complexityFilter));

    return filtered;
  };

  // --- Render acordeón por región ---
  const renderAccordion = (data) => {
    const regions = [...new Set(data.map(d => d.region))].sort();
    return regions.map(region => {
      const items = data.filter(d => d.region === region);
      const regionName = items[0]?.region_nombre || "Sin descripción";
      return (
        <details key={region} style={{ marginBottom: "10px", border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden" }}>
          <summary style={{ backgroundColor: "#0056b3", color: "white", padding: "10px", cursor: "pointer" }}>
            {region} - {regionName} ({items.length} prácticas)
          </summary>
          <div style={{ padding: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #e0e0e0", padding: "5px", backgroundColor: "#0056b3", color: "white" }}>Código</th>
                  <th style={{ border: "1px solid #e0e0e0", padding: "5px", backgroundColor: "#0056b3", color: "white" }}>Descripción</th>
                  <th style={{ border: "1px solid #e0e0e0", padding: "5px", backgroundColor: "#0056b3", color: "white" }}>Complejidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #e0e0e0", padding: "5px" }}>{r.codigo}</td>
                    <td style={{ border: "1px solid #e0e0e0", padding: "5px" }}>{r.descripcion}</td>
                    <td style={{ border: "1px solid #e0e0e0", padding: "5px" }}>{r.complejidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      );
    });
  };

  const filteredData = filterData();

  return (
    <div style={{ background: "white", borderRadius: "8px", padding: "1rem", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center", color: "#0056b3" }}>AOTER - Ortopedia y Traumatología</h2>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Buscar por código o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          <option value="">Todas las regiones</option>
          {[...new Set(natData.map(d => d.region))].sort().map(r => (
            <option key={r} value={r}>{r} - {natData.find(d => d.region === r)?.region_nombre}</option>
          ))}
        </select>
        <select value={complexityFilter} onChange={(e) => setComplexityFilter(e.target.value)}>
          <option value="">Todas las complejidades</option>
          {[...new Set(natData.map(d => d.complejidad).filter(c => c))].sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {renderAccordion(filteredData)}
    </div>
  );
}

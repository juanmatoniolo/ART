"use client";

import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import styles from "./page.module.css";

export default function Home() {
  const [activeTab, setActiveTab] = useState("art");

  const [artData, setArtData] = useState([]);
  const [natData, setNatData] = useState([]);
  const [artSearch, setArtSearch] = useState("");
  const [natSearch, setNatSearch] = useState("");
  const [artChapter, setArtChapter] = useState("");
  const [natChapter, setNatChapter] = useState("");
  const [natComplexity, setNatComplexity] = useState("");

  // --- Normalizar texto ---
  const normalizeText = (text) =>
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // --- Cargar JSON del Nomenclador Nacional ---
  useEffect(() => {
    fetch("/archivos/NomencladorDigital_con_nombres.json")
      .then((res) => res.json())
      .then((json) => {
        // Aplanamos todas las prácticas para filtrar fácilmente
        const allPractices = json.capitulos.flatMap((cap) =>
          cap.practicas.map((p) => ({
            capitulo: cap.codigo,
            capituloDescripcion: cap.descripcion,
            codigo: p.codigo,
            descripcion: p.descripcion,
            qgal: p.qgal,
            gto: p.gto,
            complejidad: p.complejidad || "",
          }))
        );
        setArtData(allPractices);
      })
      .catch((err) =>
        console.error("Error al cargar NomencladorDigital_con_nombres.json:", err)
      );
  }, []);

  // --- Cargar JSON AOTER (Traumatología) ---
  useEffect(() => {
    fetch("/archivos/Nomeclador_AOTER.json")
      .then((res) => res.json())
      .then((json) => {
        let tempData = [];
        json.practicas.forEach((region) => {
          region.practicas.forEach((pract) => {
            tempData.push({
              capitulo: region.region,
              codigo: pract.codigo,
              descripcion: pract.descripcion,
              complejidad: region.complejidad,
            });
          });
        });
        setNatData(tempData);
      })
      .catch((err) => console.error("Error al cargar JSON AOTER:", err));
  }, []);

  // --- Filtro con Fuse.js ---
  const filterData = (data, search, chapter, complexity) => {
    if (!data.length) return [];

    if (!search) {
      let filtered = data;
      if (chapter) filtered = filtered.filter((d) => d.capitulo === chapter);
      if (complexity) filtered = filtered.filter((d) => d.complejidad === complexity);
      return filtered;
    }

    const lowerSearch = normalizeText(search);

    // Coincidencias exactas
    let exactMatches = data.filter(
      (d) =>
        normalizeText(d.codigo).includes(lowerSearch) ||
        normalizeText(d.descripcion).includes(lowerSearch)
    );

    // Coincidencias parciales con Fuse.js
    const fuse = new Fuse(data, {
      keys: ["codigo", "descripcion"],
      threshold: 0.4,
      getFn: (item, key) => normalizeText(item[key]),
    });

    let partialMatches = fuse.search(search).map((r) => r.item);
    partialMatches = partialMatches.filter((d) => !exactMatches.includes(d));

    let filtered = [...exactMatches, ...partialMatches];
    if (chapter) filtered = filtered.filter((d) => d.capitulo === chapter);
    if (complexity) filtered = filtered.filter((d) => d.complejidad === complexity);

    return filtered;
  };

  // --- Resaltar coincidencias ---
  const highlightText = (text, query) => {
    if (!query) return text;
    text = String(text);

    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);
    const parts = [];
    let lastIndex = 0;

    for (let i = 0; i < normalizedText.length;) {
      if (normalizedText.slice(i, i + normalizedQuery.length) === normalizedQuery) {
        parts.push(
          <span key={i} className={styles.highlight}>
            {text.slice(i, i + normalizedQuery.length)}
          </span>
        );
        i += normalizedQuery.length;
        lastIndex = i;
      } else {
        parts.push(text[i]);
        i++;
      }
    }

    return parts;
  };

  // --- Renderizar capítulos ---
  const renderAccordion = (data, query) => {
    const chapters = [...new Set(data.map((d) => d.capitulo))].sort();

    return chapters.map((cap) => {
      const items = data.filter((d) => d.capitulo === cap);
      const chapterName = items[0]?.capituloDescripcion || cap;
      return (
        <details key={cap} className={styles.accordion}>
          <summary className={styles.summary}>
            {cap} - {chapterName} ({items.length} prácticas)
          </summary>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Q Galeno</th>
                  <th>Gto</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td>{highlightText(r.codigo, query)}</td>
                    <td>{highlightText(r.descripcion, query)}</td>
                    <td>{r.qgal}</td>
                    <td>{r.gto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      );
    });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Nomencladores Médicos</h1>

      <div className={styles.tabs}>
        <button
          className={activeTab === "art" ? styles.activeTab : ""}
          onClick={() => setActiveTab("art")}
        >
          NOMECLADOR NACIONAL
        </button>
        <button
          className={activeTab === "nat" ? styles.activeTab : ""}
          onClick={() => setActiveTab("nat")}
        >
          AOTER TRAUMATOLOGÍA
        </button>
      </div>

      {activeTab === "art" && (
        <div className={styles.panel}>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Buscar por código o descripción..."
              value={artSearch}
              onChange={(e) => setArtSearch(e.target.value)}
            />
            <select value={artChapter} onChange={(e) => setArtChapter(e.target.value)}>
              <option value="">Todos los capítulos</option>
              {[...new Set(artData.map((d) => d.capitulo))]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>
                    {c} - {artData.find((d) => d.capitulo === c)?.capituloDescripcion}
                  </option>
                ))}
            </select>
          </div>
          {renderAccordion(filterData(artData, artSearch, artChapter), artSearch)}
        </div>
      )}

      {activeTab === "nat" && (
        <div className={styles.panel}>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Buscar..."
              value={natSearch}
              onChange={(e) => setNatSearch(e.target.value)}
            />
            <select value={natChapter} onChange={(e) => setNatChapter(e.target.value)}>
              <option value="">Todos los capítulos</option>
              {[...new Set(natData.map((d) => d.capitulo))]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            <select value={natComplexity} onChange={(e) => setNatComplexity(e.target.value)}>
              <option value="">Todas las complejidades</option>
              {[...new Set(natData.map((d) => d.complejidad).filter((c) => c))]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
          {renderAccordion(filterData(natData, natSearch, natChapter, natComplexity), natSearch)}
        </div>
      )}
    </div>
  );
}

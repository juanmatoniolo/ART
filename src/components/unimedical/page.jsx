"use client";

import { useEffect, useState, useMemo } from "react";

// Paleta de colores oscuros extraída de tu sistema
const COLORS = {
    bg: "#0d1117",         // Fondo general
    surface: "#161b22",    // Fondo de tarjetas
    surface2: "#1c232c",   // Fondo de elementos internos/hover
    border: "#2a313c",     // Bordes
    text: "#e6edf3",       // Texto principal
    muted: "#9aa4b2",      // Texto secundario
    accent: "#4f9e74",     // Verde de acento
    purple: "#8b5cf6",     // Violeta para Unimedical
};

export default function NomencladorUnimedical() {
    const [data, setData] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);
    const [expandidos, setExpandidos] = useState({});

    useEffect(() => {
        fetch("/archivos/NomecladorUnimedical.json")
            .then((res) => res.json())
            .then((json) => {
                setData(json.nomencladores || []);
                if (json.nomencladores && json.nomencladores.length > 0) {
                    setExpandidos({ [json.nomencladores[0].id]: true });
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error al cargar nomenclador Unimedical:", err);
                setLoading(false);
            });
    }, []);

    const toggleExpand = (id) => {
        setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const resultadosBusqueda = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return null;

        const resultados = [];
        data.forEach((nom) => {
            nom.secciones?.forEach((sec) => {
                sec.practicas?.forEach((prac) => {
                    const texto = `${prac.codigo} ${prac.descripcion} ${nom.nombre} ${sec.nombre}`.toLowerCase();
                    if (texto.includes(q)) {
                        resultados.push({
                            ...prac,
                            nomenclador: nom.nombre,
                            seccion: sec.nombre,
                        });
                    }
                });
            });
        });
        return resultados;
    }, [data, busqueda]);

    if (loading) {
        return (
            <div style={{ padding: "3rem", textAlign: "center", color: COLORS.muted }}>
                ⏳ Cargando nomenclador Unimedical...
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* BUSCADOR */}
            <div style={{ position: "relative" }}>
                <input
                    type="search"
                    placeholder="Buscar por código, descripción o especialidad..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: `1px solid ${COLORS.border}`,
                        backgroundColor: COLORS.surface2,
                        color: COLORS.text,
                        fontSize: "0.95rem",
                        outline: "none",
                    }}
                />
                {busqueda && (
                    <button
                        onClick={() => setBusqueda("")}
                        style={{
                            position: "absolute",
                            right: "1rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            color: COLORS.muted,
                            cursor: "pointer",
                            fontSize: "1.2rem",
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* RESULTADOS DE BÚSQUEDA */}
            {resultadosBusqueda !== null ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <p style={{ fontSize: "0.85rem", color: COLORS.muted }}>
                        {resultadosBusqueda.length} resultados encontrados.
                    </p>
                    {resultadosBusqueda.map((prac) => (
                        <div
                            key={prac.id}
                            style={{
                                padding: "0.85rem",
                                backgroundColor: COLORS.surface,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: "8px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(139, 92, 246, 0.2)", color: "#a78bfa", fontWeight: "bold" }}>
                                    {prac.nomenclador}
                                </span>
                                <strong style={{ fontSize: "0.95rem", color: COLORS.text }}>{prac.codigo}</strong>
                                <span style={{ color: COLORS.text, fontSize: "0.9rem" }}>
                                    {prac.descripcion}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: COLORS.muted, marginTop: "0.25rem", flexWrap: "wrap" }}>
                                <span><b>Sección:</b> {prac.seccion}</span>
                                {prac.nivel && <span><b>Nivel:</b> {prac.nivel}</span>}
                                {prac.ayudantes !== null && <span><b>Ayudantes:</b> {prac.ayudantes}</span>}
                                {prac.porcentaje !== null && <span><b>%:</b> {prac.porcentaje}</span>}
                            </div>
                        </div>
                    ))}
                    {resultadosBusqueda.length === 0 && (
                        <div style={{ padding: "2rem", textAlign: "center", color: COLORS.muted, border: `1px dashed ${COLORS.border}`, borderRadius: "8px" }}>
                            No se encontraron prácticas con esa búsqueda.
                        </div>
                    )}
                </div>
            ) : (
                /* VISTA AGRUPADA POR NOMENCLADOR */
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {data.map((nom) => (
                        <div
                            key={nom.id}
                            style={{
                                backgroundColor: COLORS.surface,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: "12px",
                                overflow: "hidden",
                            }}
                        >
                            {/* Cabecera del Nomenclador */}
                            <button
                                onClick={() => toggleExpand(nom.id)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "1rem",
                                    backgroundColor: expandidos[nom.id] ? COLORS.surface2 : COLORS.surface,
                                    border: "none",
                                    borderBottom: expandidos[nom.id] ? `1px solid ${COLORS.border}` : "none",
                                    cursor: "pointer",
                                    color: COLORS.text,
                                    fontWeight: 800,
                                    fontSize: "1rem",
                                    transition: "background-color 0.2s",
                                }}
                            >
                                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ fontSize: "1.2rem" }}>📑</span>
                                    {nom.nombre}
                                </span>
                                <span style={{ transform: expandidos[nom.id] ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: COLORS.muted }}>
                                    ▼
                                </span>
                            </button>

                            {/* Contenido del Nomenclador */}
                            {expandidos[nom.id] && (
                                <div style={{ display: "flex", flexDirection: "column", backgroundColor: COLORS.bg }}>
                                    {nom.secciones?.map((sec, idx) => (
                                        <div key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                            {/* Título de la Sección */}
                                            <div style={{ padding: "0.75rem 1rem", backgroundColor: COLORS.surface2, fontSize: "0.8rem", fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" }}>
                                                {sec.nombre}
                                            </div>
                                            {/* Prácticas de la Sección */}
                                            <div style={{ display: "flex", flexDirection: "column", backgroundColor: COLORS.surface }}>
                                                {sec.practicas?.map((prac) => (
                                                    <div
                                                        key={prac.id}
                                                        style={{
                                                            padding: "0.75rem 1rem",
                                                            borderTop: `1px solid ${COLORS.border}`,
                                                            display: "grid",
                                                            gridTemplateColumns: "80px 1fr",
                                                            gap: "1rem",
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        <strong style={{ color: COLORS.accent }}>{prac.codigo || "—"}</strong>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: COLORS.text }}>{prac.descripcion}</div>
                                                            <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: COLORS.muted, marginTop: "0.25rem", flexWrap: "wrap" }}>
                                                                {prac.nivel && <span>Nivel: {prac.nivel}</span>}
                                                                {prac.ayudantes !== null && <span>Ayudantes: {prac.ayudantes}</span>}
                                                                {prac.porcentaje !== null && <span>Porcentaje: {prac.porcentaje}%</span>}
                                                                {prac.nota && <span style={{ color: "#f59e0b" }}>Nota: {prac.nota}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
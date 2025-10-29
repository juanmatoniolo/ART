"use client";

import { useEffect, useState } from "react";

export default function NomencladorBioquimica() {
    const [data, setData] = useState(null);
    const [filtro, setFiltro] = useState("");
    const [soloUrgencia, setSoloUrgencia] = useState(false);
    const [valorUB, setValorUB] = useState(1224.11);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // ✅ Evitamos usar window en SSR
                if (typeof window === "undefined") return;

                const baseUrl = window.location.origin;
                const res = await fetch(`${baseUrl}/archivos/NomecladorBioquimica.json`);

                if (!res.ok) {
                    throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
                }

                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("❌ Error cargando JSON:", err);
                setError("No se pudo cargar el nomenclador de Bioquímica.");
            }
        };

        loadData();
    }, []);


    // 🌀 Estado de carga
    if (error) {
        return (
            <div className="container py-5 text-center text-danger">
                <h5>{error}</h5>
                <p className="text-muted">Verificá que el archivo esté en /public/archivos/</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-success" role="status" />
                <p className="mt-3 text-muted">Cargando nomenclador bioquímico...</p>
            </div>
        );
    }

    // ✅ Si llegamos acá, ya hay datos
    const practicas = data.practicas || [];
    const practicasFiltradas = practicas.filter((p) => {
        const texto = `${p.codigo} ${p.practica_bioquimica}`.toLowerCase();
        const coincide = texto.includes(filtro.toLowerCase());
        const urg = !soloUrgencia || p.urgencia === true || p.urgencia === "U";
        return coincide && urg;
    });

    const valorPorDefecto =
        data.metadata?.unidad_bioquimica_valor_referencia || 1224.11;

    return (
        <div className="container py-5">
            {/* Encabezado */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
                <div>
                    <h1 className="fw-bold">Nomenclador Bioquímico</h1>
                </div>
            </div>

            {/* Panel de filtros */}
            <div className="card shadow-sm mb-4 border-0">
                <div className="card-body row gy-3 gx-4 align-items-center">
                    {/* Input editable de UB */}
                    <div className="col-md-4">
                        <label className="form-label fw-semibold">
                            Valor de la Unidad Bioquímica (UB)
                        </label>
                        <input
                            type="number"
                            className="form-control"
                            placeholder="1224.11"
                            step="0.01"
                            min="0"
                            value={valorUB}
                            onChange={(e) =>
                                setValorUB(parseFloat(e.target.value) || valorPorDefecto)
                            }
                        />
                        <small className="text-muted">
                            Ingresá el valor actualizado de la UB (por ejemplo: 1300.50)
                        </small>
                    </div>

                    {/* Buscador */}
                    <div className="col-md-8">
                        <label className="form-label fw-semibold">
                            Buscar práctica bioquímica
                        </label>
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar por código o nombre..."
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setFiltro("");
                                    setSoloUrgencia(false);
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                        <div className="form-check mt-2">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={soloUrgencia}
                                onChange={(e) => setSoloUrgencia(e.target.checked)}
                                id="checkUrgencia"
                            />
                            <label className="form-check-label" htmlFor="checkUrgencia">
                                Solo urgencias
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="table-responsive shadow-sm">
                <table className="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th style={{ width: "8%" }}>Código</th>
                            <th>Práctica Bioquímica</th>
                            <th style={{ width: "10%" }}>Urgencia</th>
                            <th style={{ width: "8%" }}>N/I</th>
                            <th style={{ width: "10%" }}>U.B.</th>
                            <th style={{ width: "15%" }} className="text-end">
                                Valor Estimado
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {practicasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center text-muted py-4">
                                    No se encontraron resultados.
                                </td>
                            </tr>
                        ) : (
                            practicasFiltradas.map((p) => {
                                const valor =
                                    p.unidad_bioquimica && valorUB
                                        ? (p.unidad_bioquimica * valorUB).toLocaleString("es-AR", {
                                            minimumFractionDigits: 2,
                                        })
                                        : "-";

                                return (
                                    <tr key={p.codigo}>
                                        <td className="fw-semibold text-success">{p.codigo}</td>
                                        <td>{p.practica_bioquimica}</td>
                                        <td className="text-center">
                                            {p.urgencia ? (
                                                <span className="badge bg-danger">U</span>
                                            ) : (
                                                ""
                                            )}
                                        </td>
                                        <td className="text-center">{p.nota_N_I || ""}</td>
                                        <td className="text-center">{p.unidad_bioquimica || "-"}</td>
                                        <td className="text-end fw-bold text-success">
                                            {valor !== "-" ? `$${valor}` : "-"}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-muted small mt-3">
                * Valor calculado según la Unidad Bioquímica ingresada:{" "}
                <strong>
                    ${valorUB.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </strong>
            </p>
        </div>
    );
}

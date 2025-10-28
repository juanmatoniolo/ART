"use client";

import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

export default function NomencladorBioquimica() {
    const [data, setData] = useState(null);
    const [filtro, setFiltro] = useState("");
    const [soloUrgencia, setSoloUrgencia] = useState(false);
    const [valorUB, setValorUB] = useState(1224.11); // editable por el usuario

    useEffect(() => {
        fetch("archivos/NomecladorBioquimica.json")
            .then((res) => res.json())
            .then(setData)
            .catch((err) => console.error("Error cargando JSON:", err));
    }, []);

    if (!data) {
        return (
            <div className="container text-center mt-5 text-secondary">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <p>Cargando nomenclador bioquímico...</p>
            </div>
        );
    }

    const practicas = data.practicas || [];

    // Filtro dinámico
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
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
                <div>
                    <h1 className="fw-bold text-success mb-1">
                        { "Nomenclador Bioquímico"}
                    </h1>
                
                </div>
            </div>

            {/* Valor de UB editable */}
            <div className="card shadow-sm mb-4">
                <div className="card-body row gy-2 gx-3 align-items-center">
                    <div className="col-sm-4">
                        <label className="form-label fw-semibold text-secondary">
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
                            Usá punto como separador decimal.
                        </small>
                    </div>

                    <div className="col-sm-8">
                        <label className="form-label fw-semibold text-secondary">
                            Búsqueda de práctica
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
                                className="btn btn-outline-secondary"
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
                <table className="table table-striped align-middle">
                    <thead className="table-primary">
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
                                        <td className="fw-semibold">{p.codigo}</td>
                                        <td>{p.practica_bioquimica}</td>
                                        <td className="text-center">
                                            {p.urgencia ? (
                                                <span className="badge bg-danger">U</span>
                                            ) : (
                                                ""
                                            )}
                                        </td>
                                        <td className="text-center">{p.nota_N_I || ""}</td>
                                        <td className="text-center">
                                            {p.unidad_bioquimica || "-"}
                                        </td>
                                        <td className="text-end fw-bold">${valor}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-muted small mt-3">
                * Valor calculado según la Unidad Bioquímica ingresada (${valorUB.toLocaleString(
                    "es-AR",
                    { minimumFractionDigits: 2 }
                )}).
            </p>
        </div>
    );
}

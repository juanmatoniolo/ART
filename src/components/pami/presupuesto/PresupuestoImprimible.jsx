import styles from "./PresupuestoImprimible.module.css";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";

const LOGO_SRC = "/logo.png";
const CLINICA = "Clínica de la Unión S.A.";

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
};

const fmtCantidad = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return "0";
    return String(num);
};

export default function PresupuestoImprimible({
    ref, paciente = {}, items = [], codigos = [], total = 0, nro, oncoplan = false,
}) {
    const nombre = paciente.nombreCompleto || [paciente.apellido, paciente.nombre].filter(Boolean).join(", ");

    // Solo los datos que sí importan para PAMI
    const datos = [
        { label: "Paciente", value: nombre },
        { label: "DNI", value: miles(paciente.dni) },
        { label: "Afiliado PAMI", value: paciente.afiliado },
        { label: "HC PISO", value: paciente.hcPiso },
        { label: "HC UTI", value: paciente.hcUti },
    ].filter(({ value }) => value !== undefined && value !== null && value !== "");

    const fechaActual = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

    return (
        <div ref={ref} className={styles.documento} style={{ width: "100%", backgroundColor: "#fff", color: "#202124" }}>
            <header className={styles.encabezado}>
                <div className={styles.identidad}>
                    <img src={LOGO_SRC} alt={CLINICA} className={styles.logo} style={{ maxWidth: "80px", height: "auto", maxHeight: "60px", objectFit: "contain" }} />
                    <div className={styles.nombreClinica}>
                        <strong>{CLINICA}</strong>
                        <span>Administración de prestaciones médicas</span>
                    </div>
                </div>

                <div className={styles.documentoInfo}>
                    {oncoplan && (
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 4, background: "#e11d48", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, marginBottom: 6 }}>
                            ONCOPLAN · PAMI ONCOLÓGICO
                        </span>
                    )}
                    <div className={styles.fecha}>
                        <span>Fecha: {fechaActual}</span>
                    </div>
                </div>
            </header>

            {/* DATOS DEL PACIENTE REDUCIDOS */}
            {datos.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Datos del paciente</h2>
                    <div className={styles.campos}>
                        {datos.map(({ label, value }) => (
                            <div key={label} className={styles.campo}>
                                <span className={styles.etiqueta}>{label}</span>
                                <strong className={styles.valor}>{value}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* CÓDIGOS PAMI / PRÁCTICAS */}
            {codigos.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Prácticas / Códigos PAMI</h2>
                    <table className={styles.tabla} style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th style={{ width: "8%", textAlign: "center" }}>Cant.</th>
                                <th style={{ width: "15%" }}>Código</th>
                                <th>Descripción / Médicos</th>
                                <th style={{ width: "18%", textAlign: "right" }}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codigos.map((c, i) => {
                                const cant = Number(c.cantidad) || 1;
                                const subtotal = (Number(c.monto) || 0) * cant;
                                return (
                                    <tr key={c.id ?? `cod-${i}`}>
                                        <td style={{ textAlign: "center", verticalAlign: "top", paddingTop: "6px" }}>{cant}</td>
                                        <td style={{ verticalAlign: "top", paddingTop: "6px" }}><span className={styles.codigoTxt}>{c.codigo || "—"}</span></td>
                                        <td style={{ verticalAlign: "top", paddingTop: "6px" }}>
                                            <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{c.descripcion || "Sin descripción"}</div>

                                            {/* Médicos en una sola línea */}
                                            {c.esCX ? (
                                                <div style={{ fontSize: "9px", color: "#555b63", marginTop: "3px", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    <b>Cir:</b> {c.cirujano || "-"} | <b>Ay1:</b> {c.ayudante1 || "-"} | <b>Ay2:</b> {c.ayudante2 || "-"} | <b>Anest:</b> {c.anestesista || "-"}
                                                </div>
                                            ) : (
                                                c.medico && <div style={{ fontSize: "9.5px", color: "#555b63", marginTop: "2px" }}><b>Dr. {c.medico}</b></div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "top", paddingTop: "6px" }}>{subtotal > 0 ? formatCurrency(subtotal) : "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>
            )}

            {/* MEDICACIÓN Y DESCARTABLES */}
            {items.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Medicación y descartables</h2>
                    <table className={styles.tabla} style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th className={styles.cantidad}>Cant.</th>
                                <th>Descripción del producto</th>
                                <th className={styles.precio}>P. unitario</th>
                                <th className={styles.subtotal}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id ?? `${item.nombre}-${index}`}>
                                    <td className={styles.cantidad}>{fmtCantidad(item.cantidad)}</td>
                                    <td>
                                        <span className={styles.nombreProducto}>{item.nombre}</span>
                                        {item.presentacion && <span className={styles.presentacion}> — {item.presentacion}</span>}
                                    </td>
                                    <td className={styles.precio}>{formatCurrency(item.precio)}</td>
                                    <td className={styles.subtotal}>{formatCurrency(item.precio * item.cantidad)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <footer className={styles.pie}>
                <div className={styles.total}>
                    <span>TOTAL DEL PRESUPUESTO</span>
                    <strong>{formatCurrency(total)}</strong>
                </div>
                <p className={styles.aclaracion}>
                    Documento correspondiente al presupuesto de medicación, descartables y prácticas del paciente
                    {oncoplan ? " bajo la modalidad ONCOPLAN (PAMI oncológico)." : "."}
                </p>
            </footer>
        </div>
    );
}
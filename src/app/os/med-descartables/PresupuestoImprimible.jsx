import styles from "./PresupuestoImprimible.module.css";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";

const LOGO_SRC = "/logo.png";
const CLINICA = "Clínica de la Unión S.A.";

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
};

const fmtFecha = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
};

const fmtCantidad = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return "0";
    return String(num);
};

export default function PresupuestoOSImprimible({
    ref,
    paciente = {},
    items = [],
    codigos = [],
    total = 0,
    nro,
}) {
    const nombre = paciente.nombreCompleto
        ? paciente.nombreCompleto
        : [paciente.apellido, paciente.nombre].filter(Boolean).join(", ");

    const datos = [
        { label: "Paciente", value: nombre },
        { label: "DNI", value: miles(paciente.dni) },
        { label: "Obra Social", value: paciente.obraSocial },
        { label: "Afiliado", value: paciente.afiliado },
        { label: "Historia clínica", value: paciente.historiaClinica },
        { label: "Nacimiento", value: fmtFecha(paciente.fechaNacimiento) },
        { label: "Teléfono", value: paciente.telefono },
        { label: "Domicilio", value: paciente.domicilio },
        { label: "Localidad", value: paciente.localidad },
        { label: "Provincia", value: paciente.provincia },
    ].filter(({ value }) => value !== undefined && value !== null && value !== "");

    const equipo = [
        { label: "Cirujano", value: paciente.cirujano },
        { label: "Ayudante 1", value: paciente.ayudante1 },
        { label: "Ayudante 2", value: paciente.ayudante2 },
        { label: "Anestesista", value: paciente.anestesista },
    ].filter(({ value }) => value !== undefined && value !== null && value !== "");

    const fechaActual = new Date().toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
    });

    return (
        <div ref={ref} className={styles.documento}>
            <header className={styles.encabezado}>
                <div className={styles.identidad}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt={`Logo de ${CLINICA}`} className={styles.logo} />
                    <div className={styles.nombreClinica}>
                        <strong>{CLINICA}</strong>
                        <span>Administración de prestaciones médicas</span>
                    </div>
                </div>

                <div className={styles.documentoInfo}>
                    <div className={styles.fecha}>
                        <span>Fecha: {fechaActual}</span>
                        {nro && <span>N.º {nro}</span>}
                    </div>
                </div>
            </header>

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

            {equipo.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Equipo médico</h2>
                    <div className={styles.campos}>
                        {equipo.map(({ label, value }) => (
                            <div key={label} className={styles.campo}>
                                <span className={styles.etiqueta}>{label}</span>
                                <strong className={styles.valor}>{value}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {codigos.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Prácticas / Códigos</h2>
                    <table className={styles.tabla}>
                        <thead>
                            <tr>
                                <th className={styles.colCodigo}>Código</th>
                                <th>Descripción</th>
                                <th className={styles.colMonto}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codigos.map((c, i) => (
                                <tr key={c.id ?? `cod-${i}`}>
                                    <td className={styles.colCodigo}>
                                        <span className={styles.codigoTxt}>{c.codigo || "—"}</span>
                                    </td>
                                    <td>{c.descripcion || "Sin descripción"}</td>
                                    <td className={styles.colMonto}>
                                        {c.monto > 0 ? formatCurrency(c.monto) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {items.length > 0 && (
                <section className={styles.seccion}>
                    <h2 className={styles.tituloSeccion}>Medicación y descartables</h2>
                    <table className={styles.tabla}>
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
                                        {item.presentacion && (
                                            <span className={styles.presentacion}> — {item.presentacion}</span>
                                        )}
                                    </td>
                                    <td className={styles.precio}>{formatCurrency(item.precio)}</td>
                                    <td className={styles.subtotal}>
                                        {formatCurrency(item.precio * item.cantidad)}
                                    </td>
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
                    Documento correspondiente al presupuesto de medicación, descartables y prácticas del paciente.
                </p>
            </footer>
        </div>
    );
}

import styles from "./PresupuestoImprimible.module.css";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";

const LOGO_SRC = "/logo.png";
const CLINICA = "Clínica de la Unión S.A.";

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");

    return d.length <= 8
        ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        : d;
};

const fmtFecha = (iso) => {
    if (!iso) return "";

    const [y, m, d] = String(iso).split("-");

    return y && m && d ? `${d} /${m}/${y} ` : iso;
};

export default function PresupuestoImprimible({
    ref,
    paciente = {},
    items = [],
    total = 0,
    nro,
}) {
    const nombre = [
        paciente.apellido,
        paciente.nombre,
    ]
        .filter(Boolean)
        .join(", ");

    const datos = [
        {
            label: "Paciente",
            value: nombre,
            wide: true,
        },
        {
            label: "DNI",
            value: miles(paciente.dni),
        },
        {
            label: "Afiliado PAMI",
            value: paciente.afiliado,
        },
        {
            label: "Historia clínica",
            value: paciente.historiaClinica,
        },
        {
            label: "Nacimiento",
            value: fmtFecha(paciente.fechaNacimiento),
        },
        {
            label: "Teléfono",
            value: paciente.telefono,
        },
        {
            label: "Domicilio",
            value: [
                paciente.domicilio,
                paciente.localidad,
            ]
                .filter(Boolean)
                .join(", "),
            wide: true,
        },
    ].filter(
        ({ value }) =>
            value !== undefined &&
            value !== null &&
            value !== ""
    );

    const fechaActual = new Date().toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
    });

    return (
        <div ref={ref} className={styles.documento}>
            {/* ENCABEZADO */}
            <header className={styles.encabezado}>
                <div className={styles.identidad}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={LOGO_SRC}
                        alt={`Logo de ${CLINICA} `}
                        className={styles.logo}
                    />

                    <div className={styles.nombreClinica}>
                        <strong>{CLINICA}</strong>
                        <span>
                            Administración de prestaciones médicas
                        </span>
                    </div>
                </div>

                <div className={styles.documentoInfo}>
                    <h1>PRESUPUESTO</h1>

                    <p>PAMI · Medicación y descartables</p>

                    <div className={styles.fecha}>
                        <span>Fecha: {fechaActual}</span>

                        {nro && (
                            <span>N.º {nro}</span>
                        )}
                    </div>
                </div>
            </header>

            {/* DATOS DEL PACIENTE */}
            <section className={styles.seccionPaciente}>
                <h2 className={styles.tituloSeccion}>
                    Datos del paciente
                </h2>

                <div className={styles.datosGrid}>
                    {datos.length > 0 ? (
                        datos.map(({ label, value, wide }) => (
                            <div
                                key={label}
                                className={`${styles.dato} ${wide ? styles.datoAmplio : ""
                                    } `}
                            >
                                <span className={styles.etiqueta}>
                                    {label}
                                </span>

                                <strong className={styles.valor}>
                                    {value}
                                </strong>
                            </div>
                        ))
                    ) : (
                        <p className={styles.sinDatos}>
                            Sin datos del paciente.
                        </p>
                    )}
                </div>
            </section>

            {/* TABLA DE PRODUCTOS */}
            <section className={styles.seccionProductos}>
                <h2 className={styles.tituloSeccion}>
                    Detalle de medicación y descartables
                </h2>

                <table className={styles.tabla}>
                    <thead>
                        <tr>
                            <th className={styles.cantidad}>
                                Cant.
                            </th>

                            <th>Descripción del producto</th>

                            <th className={styles.precio}>
                                P. unitario
                            </th>

                            <th className={styles.subtotal}>
                                Subtotal
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {items.map((item, index) => (
                            <tr
                                key={
                                    item.id ??
                                    `${item.nombre} -${index} `
                                }
                            >
                                <td className={styles.cantidad}>
                                    {item.cantidad}
                                </td>

                                <td>
                                    <span className={styles.nombreProducto}>
                                        {item.nombre}
                                    </span>

                                    {item.presentacion && (
                                        <span className={styles.presentacion}>
                                            {" "}— {item.presentacion}
                                        </span>
                                    )}
                                </td>

                                <td className={styles.precio}>
                                    {formatCurrency(item.precio)}
                                </td>

                                <td className={styles.subtotal}>
                                    {formatCurrency(
                                        item.precio * item.cantidad
                                    )}
                                </td>
                            </tr>
                        ))}

                        {items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className={styles.sinProductos}
                                >
                                    No hay productos cargados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* TOTAL */}
            <footer className={styles.pie}>
                <div className={styles.total}>
                    <span>TOTAL DEL PRESUPUESTO</span>

                    <strong>
                        {formatCurrency(total)}
                    </strong>
                </div>

                <p className={styles.aclaracion}>
                    Documento correspondiente al presupuesto de
                    medicación y descartables del paciente.
                </p>
            </footer>
        </div>
    );
}
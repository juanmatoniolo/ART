"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";

// ========== CONSTANTES Y FUNCIONES AUXILIARES ==========

// Opciones de ART ordenadas alfabéticamente
const ART_OPTIONS = [
    "Asociart",
    "COMFYE",
    "Federacion patronal AP",
    "Federacion patronal ART",
    "IAPS AP",
    "IAPS ART",
    "La segunda ART",
    "La segunda personas",
    "Medicar work",
    "Victoria seguros",
];

// Fecha actual para valores por defecto
const today = new Date();
const defaultDay = String(today.getDate()).padStart(2, "0");
const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
const defaultYear = String(today.getFullYear());

// Cálculo de edad exacta
function calcularEdad(nacimiento) {
    if (!nacimiento) return "";
    const [y, m, d] = nacimiento.split("-").map(Number);
    if (!y || !m || !d) return "";
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();
    if (mesActual < m || (mesActual === m && diaActual < d)) {
        edad--;
    }
    return edad >= 0 ? String(edad) : "";
}

function onlyDigits(s) {
    return (s ?? "").toString().replace(/\D/g, "");
}

function formatCuitIf11(value) {
    const d = onlyDigits(value);
    if (d.length !== 11) return value;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

// Estructura inicial del formulario (igual que en SiniestroPage)
const emptyFormData = () => ({
    ART: { nombre: "", nroSiniestro: "" },
    empleador: { nombre: "", cuit: "" },
    trabajador: {
        apellido: "",
        nombre: "",
        dni: "",
        nacimiento: "",
        edad: "",
        sexo: "",
        calle: "",
        numero: "",
        piso: "",
        depto: "",
        localidad: "",
        provincia: "",
        cp: "",
        telefono: "",
    },
    consulta: { tipo: "" },
    fechaIngreso: { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" },
    fechaDenuncia: { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" },
    prestador: {}, // se llena desde el backend si es necesario
});

// ========== COMPONENTES INTERNOS ==========

// Inputs para día/mes/año
function DatePartInput({ label, value, onChange, placeholder, maxLength, error, className }) {
    return (
        <div className={className}>
            <label className={styles.label}>{label}</label>
            <input
                className={error ? `${styles.input} ${styles.inputError}` : styles.input}
                value={value}
                onChange={onChange}
                inputMode="numeric"
                placeholder={placeholder}
                maxLength={maxLength}
            />
            {error && <div className={styles.errorText}>{error}</div>}
        </div>
    );
}

// Componente de sección (reutilizado del SiniestroPage)
function Section({ title, subtitle, children }) {
    return (
        <section className={styles.section}>
            <div className={styles.sectionHead}>
                <div>
                    <h3 className={styles.sectionTitle}>{title}</h3>
                    {subtitle && <div className={styles.sectionHint}>{subtitle}</div>}
                </div>
            </div>
            {children}
        </section>
    );
}

// ========== PÁGINA PRINCIPAL ==========
export default function PacientesPage() {
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPaciente, setEditingPaciente] = useState(null);
    const [formData, setFormData] = useState(emptyFormData());
    const [formErrors, setFormErrors] = useState({});

    // Estado para el modal de WhatsApp
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [selectedPaciente, setSelectedPaciente] = useState(null);

    // Refs para manejar el envío
    const submittingRef = useRef(false);

    // Cargar pacientes desde Firebase
    const fetchPacientes = async () => {
        try {
            const res = await fetch(
                "https://datos-clini-default-rtdb.firebaseio.com/pacientes.json"
            );
            if (!res.ok) throw new Error("Error al cargar pacientes");
            const data = await res.json();
            if (data) {
                const pacientesArray = Object.entries(data).map(([id, value]) => ({
                    id,
                    ...value,
                }));
                pacientesArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setPacientes(pacientesArray);
            } else {
                setPacientes([]);
            }
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar los pacientes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPacientes();
    }, []);

    // Filtrar pacientes
    const filteredPacientes = pacientes.filter((paciente) => {
        const fullName = `${paciente.trabajador?.apellido || ""} ${paciente.trabajador?.nombre || ""
            }`.toLowerCase();
        const dni = paciente.trabajador?.dni || "";
        return fullName.includes(searchTerm.toLowerCase()) || dni.includes(searchTerm);
    });

    // Abrir modal para agregar
    const openAddModal = () => {
        setEditingPaciente(null);
        setFormData(emptyFormData());
        setFormErrors({});
        setShowModal(true);
    };

    // Abrir modal para editar
    const openEditModal = (paciente) => {
        setEditingPaciente(paciente);
        // Asegurar que las fechas tengan valores por defecto si faltan
        const fechaIngreso = paciente.fechaIngreso || { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" };
        const fechaDenuncia = paciente.fechaDenuncia || { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" };
        setFormData({
            ART: paciente.ART || { nombre: "", nroSiniestro: "" },
            empleador: paciente.empleador || { nombre: "", cuit: "" },
            trabajador: paciente.trabajador || {
                apellido: "",
                nombre: "",
                dni: "",
                nacimiento: "",
                edad: "",
                sexo: "",
                calle: "",
                numero: "",
                piso: "",
                depto: "",
                localidad: "",
                provincia: "",
                cp: "",
                telefono: "",
            },
            consulta: paciente.consulta || { tipo: "" },
            fechaIngreso,
            fechaDenuncia,
            prestador: paciente.prestador || {},
        });
        setFormErrors({});
        setShowModal(true);
    };

    // Cerrar modal
    const closeModal = () => {
        setShowModal(false);
        setEditingPaciente(null);
    };

    // Manejar cambios en los campos anidados
    const handleInputChange = (e, section, field) => {
        const { value } = e.target;
        setFormData((prev) => {
            if (section) {
                return {
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [field]: value,
                    },
                };
            }
            return {
                ...prev,
                [field]: value,
            };
        });
    };

    // Manejar cambios directos en el trabajador (para nacimiento que recalcula edad)
    const handleTrabajadorChange = (e, field) => {
        const { value } = e.target;
        setFormData((prev) => {
            const updatedTrabajador = { ...prev.trabajador, [field]: value };
            if (field === "nacimiento") {
                updatedTrabajador.edad = calcularEdad(value);
            }
            return { ...prev, trabajador: updatedTrabajador };
        });
    };

    // Validación básica (similar a la de SiniestroPage)
    const validateForm = () => {
        const errors = {};
        const dni = onlyDigits(formData.trabajador.dni);
        if (dni && (dni.length < 7 || dni.length > 9)) {
            errors.trabajadorDni = "DNI inválido (7 a 9 dígitos)";
        }
        const tel = onlyDigits(formData.trabajador.telefono);
        if (tel && tel.length < 8) {
            errors.trabajadorTelefono = "Teléfono inválido";
        }
        // Validar fechas
        const validarFecha = (dia, mes, anio, prefix) => {
            const d = Number(dia), m = Number(mes), a = Number(anio);
            if (dia && (d < 1 || d > 31)) errors[`${prefix}Dia`] = "Día inválido";
            if (mes && (m < 1 || m > 12)) errors[`${prefix}Mes`] = "Mes inválido";
            if (anio && (a < 1900 || a > 2100)) errors[`${prefix}Anio`] = "Año inválido";
        };
        validarFecha(formData.fechaIngreso.dia, formData.fechaIngreso.mes, formData.fechaIngreso.anio, "ingreso");
        validarFecha(formData.fechaDenuncia.dia, formData.fechaDenuncia.mes, formData.fechaDenuncia.anio, "denuncia");
        return errors;
    };

    // Guardar paciente (crear o actualizar)
    const handleSave = async (e) => {
        e.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;

        const errors = validateForm();
        if (Object.keys(errors).length) {
            setFormErrors(errors);
            submittingRef.current = false;
            return;
        }

        try {
            const url = editingPaciente
                ? `https://datos-clini-default-rtdb.firebaseio.com/pacientes/${editingPaciente.id}.json`
                : "https://datos-clini-default-rtdb.firebaseio.com/pacientes.json";
            const method = editingPaciente ? "PUT" : "POST";

            // Preparar payload con ISO de fechas
            const isoIngreso = `${formData.fechaIngreso.anio}-${formData.fechaIngreso.mes.padStart(2, "0")}-${formData.fechaIngreso.dia.padStart(2, "0")}`;
            const isoDenuncia = `${formData.fechaDenuncia.anio}-${formData.fechaDenuncia.mes.padStart(2, "0")}-${formData.fechaDenuncia.dia.padStart(2, "0")}`;

            const payload = {
                ...formData,
                fechaIngreso: { ...formData.fechaIngreso, iso: isoIngreso },
                fechaDenuncia: { ...formData.fechaDenuncia, iso: isoDenuncia },
                updatedAt: Date.now(),
                ...(!editingPaciente && { createdAt: Date.now() }),
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Error al guardar");
            await fetchPacientes();
            closeModal();
        } catch (err) {
            console.error(err);
            alert("Error al guardar el paciente.");
        } finally {
            submittingRef.current = false;
        }
    };

    // Eliminar paciente
    const handleDelete = async (id) => {
        if (!confirm("¿Estás seguro de eliminar este paciente?")) return;
        try {
            const res = await fetch(
                `https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}.json`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Error al eliminar");
            await fetchPacientes();
        } catch (err) {
            console.error(err);
            alert("Error al eliminar el paciente.");
        }
    };

    // Abrir modal de WhatsApp
    const openWhatsAppModal = (paciente) => {
        setSelectedPaciente(paciente);
        setShowWhatsApp(true);
    };

    const closeWhatsAppModal = () => {
        setShowWhatsApp(false);
        setSelectedPaciente(null);
    };

    if (loading) {
        return <div className={styles.loading}>Cargando pacientes...</div>;
    }

    if (error) {
        return <div className={styles.error}>{error}</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Pacientes</h1>
                <div className={styles.actions}>
                    <button className={styles.addBtn} onClick={openAddModal}>
                        + Nuevo Paciente
                    </button>
                    <div className={styles.search}>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>
            </div>

            {filteredPacientes.length === 0 ? (
                <div className={styles.empty}>
                    {searchTerm
                        ? "No se encontraron pacientes con ese criterio."
                        : "No hay pacientes registrados."}
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Apellido y Nombre</th>
                                <th>DNI</th>
                                <th>Edad</th>
                                <th>Teléfono</th>
                                <th>ART</th>
                                <th>N° Siniestro</th>
                                <th>Fecha Ingreso</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPacientes.map((paciente) => {
                                const t = paciente.trabajador || {};
                                const art = paciente.ART || {};
                                const fechaIngreso = paciente.fechaIngreso || {};
                                const telefono = t.telefono || "";

                                return (
                                    <tr key={paciente.id}>
                                        <td>
                                            {t.apellido} {t.nombre}
                                        </td>
                                        <td>{t.dni || "—"}</td>
                                        <td>{t.edad ? `${t.edad} años` : "—"}</td>
                                        <td>{telefono || "—"}</td>
                                        <td>{art.nombre || "—"}</td>
                                        <td>{art.nroSiniestro || "—"}</td>
                                        <td>
                                            {fechaIngreso.dia && fechaIngreso.mes && fechaIngreso.anio
                                                ? `${fechaIngreso.dia}/${fechaIngreso.mes}/${fechaIngreso.anio}`
                                                : "—"}
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => openEditModal(paciente)}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDelete(paciente.id)}
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                            {telefono && (
                                                <button
                                                    className={styles.whatsappBtn}
                                                    onClick={() => openWhatsAppModal(paciente)}
                                                    title="Enviar WhatsApp"
                                                >
                                                    📱
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de alta/edición de paciente */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>{editingPaciente ? "Editar Paciente" : "Nuevo Paciente"}</h2>
                        <form onSubmit={handleSave} className={styles.modalForm}>
                            {/* ===== ART + Motivo ===== */}
                            <Section title="ART + Motivo" subtitle="Todos los campos son opcionales">
                                <div className={styles.grid}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>ART</label>
                                        <select
                                            className={styles.input}
                                            value={formData.ART.nombre}
                                            onChange={(e) => handleInputChange(e, "ART", "nombre")}
                                        >
                                            <option value="">Seleccione una ART</option>
                                            {ART_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>N° siniestro</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.ART.nroSiniestro}
                                            onChange={(e) => handleInputChange(e, "ART", "nroSiniestro")}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                    <div className={styles.fieldFull}>
                                        <label className={styles.label}>Motivo de consulta</label>
                                        <div className={styles.chips}>
                                            {[
                                                ["AT", "Accidente de trabajo"],
                                                ["AIT", "Accidente In Itinere"],
                                                ["EP", "Enfermedad Profesional"],
                                                ["INT", "Intercurrencia"],
                                            ].map(([val, label]) => (
                                                <label
                                                    key={val}
                                                    className={`${styles.chip} ${formData.consulta.tipo === val ? styles.chipActive : ""
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="motivo"
                                                        value={val}
                                                        checked={formData.consulta.tipo === val}
                                                        onChange={(e) => handleInputChange(e, "consulta", "tipo")}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            {/* ===== Fechas ===== */}
                            <Section title="Fechas" subtitle="Fecha de ingreso y fecha de denuncia">
                                <div className={styles.fechasWrapper}>
                                    <div className={styles.fechaGroup}>
                                        <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
                                        <div className={styles.fechaRow}>
                                            <DatePartInput
                                                label="Día"
                                                value={formData.fechaIngreso.dia}
                                                onChange={(e) => handleInputChange(e, "fechaIngreso", "dia")}
                                                placeholder="DD"
                                                maxLength={2}
                                                error={formErrors.ingresoDia}
                                                className={styles.datePartField}
                                            />
                                            <DatePartInput
                                                label="Mes"
                                                value={formData.fechaIngreso.mes}
                                                onChange={(e) => handleInputChange(e, "fechaIngreso", "mes")}
                                                placeholder="MM"
                                                maxLength={2}
                                                error={formErrors.ingresoMes}
                                                className={styles.datePartField}
                                            />
                                            <DatePartInput
                                                label="Año"
                                                value={formData.fechaIngreso.anio}
                                                onChange={(e) => handleInputChange(e, "fechaIngreso", "anio")}
                                                placeholder="AAAA"
                                                maxLength={4}
                                                error={formErrors.ingresoAnio}
                                                className={`${styles.datePartField} ${styles.datePartWide}`}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.fechaGroup}>
                                        <div className={styles.fechaGroupLabel}>Fecha de denuncia</div>
                                        <div className={styles.fechaRow}>
                                            <DatePartInput
                                                label="Día"
                                                value={formData.fechaDenuncia.dia}
                                                onChange={(e) => handleInputChange(e, "fechaDenuncia", "dia")}
                                                placeholder="DD"
                                                maxLength={2}
                                                error={formErrors.denunciaDia}
                                                className={styles.datePartField}
                                            />
                                            <DatePartInput
                                                label="Mes"
                                                value={formData.fechaDenuncia.mes}
                                                onChange={(e) => handleInputChange(e, "fechaDenuncia", "mes")}
                                                placeholder="MM"
                                                maxLength={2}
                                                error={formErrors.denunciaMes}
                                                className={styles.datePartField}
                                            />
                                            <DatePartInput
                                                label="Año"
                                                value={formData.fechaDenuncia.anio}
                                                onChange={(e) => handleInputChange(e, "fechaDenuncia", "anio")}
                                                placeholder="AAAA"
                                                maxLength={4}
                                                error={formErrors.denunciaAnio}
                                                className={`${styles.datePartField} ${styles.datePartWide}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            {/* ===== Empleador ===== */}
                            <Section title="Empleador" subtitle="Todos los campos son opcionales">
                                <div className={styles.grid}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Nombre empresa</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.empleador.nombre}
                                            onChange={(e) => handleInputChange(e, "empleador", "nombre")}
                                            placeholder="Razón social (opcional)"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>CUIT / DNI</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.empleador.cuit}
                                            onChange={(e) => handleInputChange(e, "empleador", "cuit")}
                                            onBlur={(e) => {
                                                const formatted = formatCuitIf11(e.target.value);
                                                if (formatted !== e.target.value) {
                                                    handleInputChange({ target: { value: formatted } }, "empleador", "cuit");
                                                }
                                            }}
                                            placeholder="Opcional (solo números)"
                                        />
                                    </div>
                                </div>
                            </Section>

                            {/* ===== Trabajador ===== */}
                            <Section title="Trabajador" subtitle="Todos los campos son opcionales">
                                <div className={styles.grid}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Apellido</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.apellido}
                                            onChange={(e) => handleTrabajadorChange(e, "apellido")}
                                            placeholder="Apellido"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Nombre</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.nombre}
                                            onChange={(e) => handleTrabajadorChange(e, "nombre")}
                                            placeholder="Nombre"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>DNI</label>
                                        <input
                                            type="text"
                                            className={`${styles.input} ${formErrors.trabajadorDni ? styles.inputError : ""
                                                }`}
                                            value={formData.trabajador.dni}
                                            onChange={(e) => handleTrabajadorChange(e, "dni")}
                                            placeholder="DNI"
                                        />
                                        {formErrors.trabajadorDni && (
                                            <div className={styles.errorText}>{formErrors.trabajadorDni}</div>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Fecha de nacimiento</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={formData.trabajador.nacimiento}
                                            onChange={(e) => handleTrabajadorChange(e, "nacimiento")}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Edad (calculada)</label>
                                        <input
                                            type="text"
                                            className={`${styles.input} ${styles.inputReadonly}`}
                                            value={formData.trabajador.edad ? `${formData.trabajador.edad} años` : ""}
                                            readOnly
                                            placeholder="Se calcula automáticamente"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Sexo</label>
                                        <div className={styles.chips}>
                                            {["M", "F"].map((val) => (
                                                <label
                                                    key={val}
                                                    className={`${styles.chip} ${formData.trabajador.sexo === val ? styles.chipActive : ""
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="sexo"
                                                        value={val}
                                                        checked={formData.trabajador.sexo === val}
                                                        onChange={(e) => handleTrabajadorChange(e, "sexo")}
                                                    />
                                                    {val}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Teléfono</label>
                                        <input
                                            type="tel"
                                            className={`${styles.input} ${formErrors.trabajadorTelefono ? styles.inputError : ""
                                                }`}
                                            value={formData.trabajador.telefono}
                                            onChange={(e) => handleTrabajadorChange(e, "telefono")}
                                            placeholder="Teléfono"
                                        />
                                        {formErrors.trabajadorTelefono && (
                                            <div className={styles.errorText}>{formErrors.trabajadorTelefono}</div>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Calle</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.calle}
                                            onChange={(e) => handleTrabajadorChange(e, "calle")}
                                            placeholder="Calle"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Número</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.numero}
                                            onChange={(e) => handleTrabajadorChange(e, "numero")}
                                            placeholder="N°"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Piso</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.piso}
                                            onChange={(e) => handleTrabajadorChange(e, "piso")}
                                            placeholder="Piso"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Depto</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.depto}
                                            onChange={(e) => handleTrabajadorChange(e, "depto")}
                                            placeholder="Depto"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Localidad</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.localidad}
                                            onChange={(e) => handleTrabajadorChange(e, "localidad")}
                                            placeholder="Localidad"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Provincia</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.provincia}
                                            onChange={(e) => handleTrabajadorChange(e, "provincia")}
                                            placeholder="Provincia"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>CP</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={formData.trabajador.cp}
                                            onChange={(e) => handleTrabajadorChange(e, "cp")}
                                            placeholder="CP"
                                        />
                                    </div>
                                </div>
                            </Section>

                            <div className={styles.modalActions}>
                                <button type="button" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de WhatsApp */}
            {showWhatsApp && selectedPaciente && (
                <div className={styles.modalOverlay} onClick={closeWhatsAppModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <WhatsAppSender paciente={selectedPaciente} onClose={closeWhatsAppModal} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ========== COMPONENTE WHATSAPP SENDER (COMPLETO) ==========
function WhatsAppSender({ paciente, onClose }) {
    const [phone, setPhone] = useState(paciente.trabajador?.telefono || "");
    const [name, setName] = useState(
        `${paciente.trabajador?.apellido || ""} ${paciente.trabajador?.nombre || ""}`.trim()
    );
    const [dia, setDia] = useState("");
    const [hora, setHora] = useState("");
    const [mensaje, setMensaje] = useState("1");
    const [bioquimico, setBioquimico] = useState("confalonieri");
    const [cardiologo, setCardiologo] = useState("percara");
    const [preview, setPreview] = useState("");

    const requiresDateTime = ["2", "4", "5", "6", "7"].includes(mensaje);

    // Función para construir el mensaje según el tipo seleccionado
    const buildMessage = () => {
        if (mensaje === "1") {
            return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que *sus sesiones de kinesiología fueron aprobadas*.
Puede pasar a retirar la autorización por *Mesa de Entrada*, de *lunes a viernes de 8 a 12 hs* o de *16 a 20 hs*, y *sábados de 8 a 12 hs*.
Ingreso por *Roque Sáenz Peña*.

También le dejamos las kinesiólogas que trabajan con ART:

• *Daniela Rivas*
  Consultorio: 9 de Julio 1870 (Chajarí – E.R.)

• *Avancini Natali*
  Consultorio: Rivadavia 2665 (Chajarí – E.R.)

En caso de que su ART sea *IAPS*, puede comunicarse para consultar la cartilla de profesionales afiliados.`;
        }
        if (mensaje === "2") {
            return `Buen día, *${name}*.
Le escribimos desde Clínica de la Unión. Su *resonancia fue aprobada* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones importantes:*
• Límite de peso: *140 kg*
• Asistir con ropa cómoda y *DNI físico*
• Llegar *15 minutos antes* del turno
• *Avisar si posee*: prótesis metálicas, implante coclear, marcapasos, válvula cardíaca o cirugías recientes
• Puede asistir con *un acompañante* (en sala de espera)

*Ingreso por Avenida Siburu 1085.* (Imágenes Médicas)`;
        }
        if (mensaje === "3") {
            return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que *sus medicamentos fueron aprobados*.
Puede pasar a retirar la orden por *Mesa de Entrada*, de *lunes a viernes de 8 a 12 hs* o de *16 a 20 hs*, y *sábados de 8 a 12 hs*.
Ingreso por *Roque Sáenz Peña*.

*Cómo trabajan las ART:*

• *IAPS*: Presentarse con la orden en Farmacia Zordan o Farmacia de la Unión.
• *Federación Patronal*: Orden + denuncia → Farmacia Del Pueblo.
• *La Segunda*: Orden + copia de la denuncia → Farmacia de la Unión.
• *Otras ART*: Orden + copia de la denuncia → Farmacia Zordan o Farmacia de la Unión.`;
        }
        if (mensaje === "4") {
            const profesional =
                cardiologo === "percara"
                    ? `Dr. Percara
*Dirección:* Bolívar 1695 (esquina con 9 de Julio)`
                    : `Dr. Capovilla
*Dirección:* Bolívar 1645 (entre Pablo Estampa y 9 de Julio)`;
            return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *electrocardiograma fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones:*
• Asistir con documento
• Llegar 15 minutos antes

*Profesional:*
${profesional}`;
        }
        if (mensaje === "5") {
            const profesional =
                bioquimico === "confalonieri"
                    ? `Bioquímica Confalonieri
*Dirección:* Belgrano y Corrientes (frente a la juguetería Pepos)`
                    : `Bioquímico Mármol
*Dirección:* Sarmiento 2610`;
            return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *estudio de laboratorio fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Profesional:*
${profesional}

*Requisitos:*
• Presentarse con 8 horas de ayuno
• Llevar documento
• Llegar 10 a 15 minutos antes`;
        }
        if (mensaje === "6") {
            return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *ecografía fue aprobada* y tiene turno para *${dia} a las ${hora}*.

*Lugar de realización:*
Sector de *BioImagen* dentro de Clínica de la Unión.
En caso de no conocer la ubicación, puede consultar en *Mesa de Entrada*.

*Indicaciones:*
• Asistir con documento
• Llegar 10 a 15 minutos antes`;
        }
        if (mensaje === "7") {
            return `CLÍNICA DE LA UNIÓN S.A.

Buen día, *${name}*.

Le informamos que su *intervención quirúrgica ha sido aprobada*.

Para continuar con el circuito administrativo y la programación, le solicitamos que se presente el *${dia} a las ${hora}*. 

Favor de completar y enviar por este medio los siguientes datos:


• Apellido:
• Nombre:
• DNI / CUIL:
• Fecha de nacimiento (dd/mm/aaaa):
• Edad actual:
• Lugar de nacimiento (ciudad, provincia, país):


• Domicilio habitual:
• Localidad:
• Provincia:

• Teléfono (con característica):

*IMPORTANTE*
El día de la cirugía deberá presentar obligatoriamente:
• DNI físico original
• Fotocopia del DNI (frente y dorso)

Quedamos a la espera de su información para avanzar.

Muchas gracias.`;
        }
        if (mensaje === "8") {
            return `Buen día, *${name}*.

Le informamos los pasos para retirar su ortopedia:

1. *Retirar autorización* en Mesa de Entrada de la Clínica (ingreso por Roque Sáenz Peña).  
   Horarios: Lun a vie 8-12 y 16-20, sáb 8-12.

2. *Ir a Distrimed* (9 de Julio 3240, frente a Farmacia Barbieri) con:  
   - Copia de la denuncia  
   - Autorización ortopédica

3. *Consultar cobertura* en la ortopedia:  
   - Si la ART cubre el 100%, retira sin cargo.  
   - Si no, debe abonar y luego pedir reintegro a su ART (guardar factura).`;
        }
        return "";
    };

    // Recalcular preview cada vez que cambian los campos relevantes
    useEffect(() => {
        setPreview(buildMessage());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, dia, hora, mensaje, bioquimico, cardiologo]);

    const createWaLink = () => {
        if (!phone) return "";
        return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(preview)}`;
    };

    const canSend = phone && name && (!requiresDateTime || (dia && hora));

    return (
        <div>
            <div className={styles.whatsappHeader}>
                <h2>Enviar WhatsApp</h2>
                <button className={styles.closeBtn} onClick={onClose}>
                    ✕
                </button>
            </div>
            <div className={styles.whatsappForm}>
                <div className={styles.formGroup}>
                    <label>Teléfono</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                    <label>Nombre</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                {requiresDateTime && (
                    <>
                        <div className={styles.formGroup}>
                            <label>Día del turno</label>
                            <input
                                placeholder="Ej: lunes 15/04"
                                value={dia}
                                onChange={(e) => setDia(e.target.value)}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Hora del turno</label>
                            <input
                                placeholder="Ej: 10:30"
                                value={hora}
                                onChange={(e) => setHora(e.target.value)}
                            />
                        </div>
                    </>
                )}
                <div className={styles.formGroup}>
                    <label>Tipo de mensaje</label>
                    <select value={mensaje} onChange={(e) => setMensaje(e.target.value)}>
                        <option value="1">FKT Aprobada</option>
                        <option value="2">RMN Aprobada</option>
                        <option value="3">Medicamentos Aprobados</option>
                        <option value="4">Electrocardiograma</option>
                        <option value="5">Estudios Laboratorio</option>
                        <option value="6">Ecografía Aprobada</option>
                        <option value="7">Cirugía Aprobada</option>
                        <option value="8">Ortopedia</option>
                    </select>
                </div>
                {mensaje === "5" && (
                    <div className={styles.formGroup}>
                        <label>Bioquímico</label>
                        <select value={bioquimico} onChange={(e) => setBioquimico(e.target.value)}>
                            <option value="confalonieri">Bioquímica Confalonieri</option>
                            <option value="marmol">Bioquímico Mármol</option>
                        </select>
                    </div>
                )}
                {mensaje === "4" && (
                    <div className={styles.formGroup}>
                        <label>Cardiólogo</label>
                        <select value={cardiologo} onChange={(e) => setCardiologo(e.target.value)}>
                            <option value="percara">Dr. Percara</option>
                            <option value="capovilla">Dr. Capovilla</option>
                        </select>
                    </div>
                )}
                <div className={styles.formGroup}>
                    <label>Vista previa (editable)</label>
                    <textarea
                        rows={10}
                        value={preview}
                        onChange={(e) => setPreview(e.target.value)}
                        className={styles.textarea}
                    />
                </div>
                <a
                    href={canSend ? createWaLink() : "#"}
                    target="_blank"
                    className={`${styles.button} ${!canSend ? styles.buttonDisabled : ""}`}
                    onClick={(e) => !canSend && e.preventDefault()}
                    rel="noreferrer"
                >
                    Enviar WhatsApp
                </a>
            </div>
        </div>
    );
}
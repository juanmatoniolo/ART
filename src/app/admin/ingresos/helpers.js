import styles from "./ingresos.module.css";

export const MESES_ES = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

export const PRESTADOR_CONST = {
	nombre: "CLINICA DE LA UNION S.A",
	cuit: "30-70754530-1",
	calle: "Av. Siburu",
	nro: "1085",
	piso: "-",
	depto: "-",
	localidad: "Chajari",
	provincia: "Entre Rios",
	cp: "3228",
	celular: "3456-441580",
	mail: "clinicadelaunionart@gmail.com",
};

const today = new Date();
export const defaultDay = String(today.getDate()).padStart(2, "0");
export const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
export const defaultYearShort = String(today.getFullYear()).slice(-2);

export const initialForm = {
	tipoIngreso: "PISO",
	trabajadorApellido: "",
	trabajadorNombre: "",
	trabajadorDni: "",
	trabajadorNacimiento: "",
	trabajadorNacimientoDia: "",
	trabajadorNacimientoMes: "",
	trabajadorNacimientoAnio: "",
	trabajadorSexo: "",
	trabajadorCalle: "",
	trabajadorNumero: "",
	trabajadorPiso: "",
	trabajadorDepto: "",
	trabajadorLocalidad: "",
	trabajadorProvincia: "",
	trabajadorCP: "",
	trabajadorTelefono: "",
	trabajadorEdad: "",
	diaIngreso: defaultDay,
	mesIngreso: defaultMonth,
	anioIngreso: defaultYearShort,
	OS: "",
	afiliadoPaciente: "",
	historiaClinica: "",
	familiarNombre: "",
	familiarParentezco: "",
	familiarTelefono: "",
	camaNumero: "",
	camaLetra: "",
	medicoSolicitante: "",
	diagnostico: "",
};

export function onlyDigits(s) {
	return (s ?? "").toString().replace(/\D/g, "");
}

export function normalizeYear2(v) {
	const d = onlyDigits(v);
	if (!d) return "";
	if (d.length >= 4) return d.slice(-2);
	return d.padStart(2, "0").slice(-2);
}

export function formatCuil(digits) {
	if (digits.length !== 11) return digits;
	return `${digits.slice(0, 2)}-${digits.slice(2, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}-${digits.slice(10)}`;
}

export function formatDni(digits) {
	if (!digits) return "";
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatIdField(value) {
	const d = onlyDigits(value);
	if (!d) return value;
	if (d.length === 11) return formatCuil(d);
	return formatDni(d);
}

export function calcularEdad(nacimiento) {
	if (!nacimiento) return "";
	const [y, m, d] = nacimiento.split("-").map(Number);
	if (!y || !m || !d) return "";
	const hoy = new Date();
	let edad = hoy.getFullYear() - y;
	const mesActual = hoy.getMonth() + 1;
	const diaActual = hoy.getDate();
	if (mesActual < m || (mesActual === m && diaActual < d)) edad--;
	return edad >= 0 ? String(edad) : "";
}

export function nombreMes(m) {
	const n = Number(onlyDigits(m));
	if (!n || n < 1 || n > 12) return "";
	return MESES_ES[n - 1];
}

export function buildNacimientoISO(form) {
	const d = onlyDigits(form.trabajadorNacimientoDia);
	const m = onlyDigits(form.trabajadorNacimientoMes);
	const a = onlyDigits(form.trabajadorNacimientoAnio);
	if (!d || !m || a.length !== 4) return "";
	const dd = Number(d);
	const mm = Number(m);
	if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return "";
	return `${a}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function splitNacimientoISO(iso) {
	const s = (iso || "").trim();
	if (!s) return { dia: "", mes: "", anio: "" };
	const [y, m, d] = s.split("-");
	return { dia: d || "", mes: m || "", anio: y || "" };
}

export function buildHabitacionCama(form) {
	const num = (form.camaNumero || "").toString().trim();
	const letra = (form.camaLetra || "").toString().trim().toUpperCase();
	if (!num) return "";
	if (form.tipoIngreso === "UTI") return num;
	return letra ? `${num}${letra}` : num;
}

export function buildHabitacionCamaTexto(form) {
	if (form.tipoIngreso === "UTI") {
		const num = (form.camaNumero || "").toString().trim();
		return num ? `CAMA: ${num}` : "";
	}
	const hab = buildHabitacionCama(form);
	return hab ? `HAB.: ${hab}` : "";
}

export function getPdfPages(tipoIngreso) {
	if (tipoIngreso === "UTI") return [1, 9, 10, 11, 12];
	return [1, 2, 3, 4, 5, 6, 7, 8];
}

export function splitNombreCompleto(full) {
	const s = (full || "").trim();
	if (!s) return { apellido: "", nombre: "" };
	if (s.includes(",")) {
		const [a, ...rest] = s.split(",");
		return { apellido: a.trim(), nombre: rest.join(",").trim() };
	}
	const parts = s.split(/\s+/);
	if (parts.length === 1) return { apellido: parts[0], nombre: "" };
	if (parts.length >= 4) {
		return {
			apellido: parts.slice(0, 2).join(" "),
			nombre: parts.slice(2).join(" "),
		};
	}
	return { apellido: parts[0], nombre: parts.slice(1).join(" ") };
}

export function parseHCNumber(item) {
	const raw =
		item?.historia_clinica ??
		item?.historia_clinica_1 ??
		item?.historiaClinica ??
		item?.hc ??
		"";
	const digits = String(raw).replace(/\D/g, "");
	return digits ? Number(digits) : null;
}

export function sanitizeSeg(s) {
	return (s || "")
		.toString()
		.trim()
		.toUpperCase()
		.replace(/\s+/g, "_")
		.replace(/[^A-Z0-9._-]/g, "");
}

export function buildFolderName(form) {
	const apellido = sanitizeSeg(form.trabajadorApellido) || "SIN_APELLIDO";
	const nombre = sanitizeSeg(form.trabajadorNombre) || "SIN_NOMBRE";
	const os = sanitizeSeg(form.OS) || "ART";
	const afiliado = sanitizeSeg(form.afiliadoPaciente) || "SIN_AFILIADO";
	return `${apellido}-${nombre}-${os}-${afiliado}`;
}

/* =========================================================
   🆕 Convertir a WebP redimensionando (evita error 413)
   ========================================================= */
export async function convertToWebP(file, quality = 0.75, maxDim = 1600) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				let { width, height } = img;

				// Redimensionar si supera maxDim
				if (width > maxDim || height > maxDim) {
					if (width >= height) {
						height = Math.round((height * maxDim) / width);
						width = maxDim;
					} else {
						width = Math.round((width * maxDim) / height);
						height = maxDim;
					}
				}

				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, width, height);

				canvas.toBlob(
					(blob) => {
						if (!blob)
							return reject(
								new Error("No se pudo convertir a WebP"),
							);
						resolve(blob);
					},
					"image/webp",
					quality,
				);
			};
			img.onerror = () => reject(new Error("Imagen inválida"));
			img.src = e.target.result;
		};
		reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
		reader.readAsDataURL(file);
	});
}

/* =========================================================
   🆕 Recortar al ratio (formato DNI por defecto)
   ========================================================= */
export async function cropToRatio(blob, ratio = 1.585) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			try {
				const w = img.width;
				const h = img.height;
				const currentRatio = w / h;
				let sx = 0,
					sy = 0,
					sw = w,
					sh = h;
				if (currentRatio > ratio) {
					sw = h * ratio;
					sx = (w - sw) / 2;
				} else {
					sh = w / ratio;
					sy = (h - sh) / 2;
				}
				const canvas = document.createElement("canvas");
				canvas.width = Math.round(sw);
				canvas.height = Math.round(sh);
				const ctx = canvas.getContext("2d");
				ctx.drawImage(
					img,
					sx,
					sy,
					sw,
					sh,
					0,
					0,
					canvas.width,
					canvas.height,
				);
				canvas.toBlob(
					(b) => {
						URL.revokeObjectURL(url);
						if (!b) return reject(new Error("No se pudo recortar"));
						resolve(b);
					},
					"image/webp",
					0.8,
				);
			} catch (e) {
				URL.revokeObjectURL(url);
				reject(e);
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Error cargando imagen"));
		};
		img.src = url;
	});
}

export function validate(f) {
	const e = {};
	if (!f.tipoIngreso || !["PISO", "UTI"].includes(f.tipoIngreso))
		e.tipoIngreso = "Debe seleccionar PISO o UTI";
	if (!onlyDigits(f.camaNumero))
		e.camaNumero = "El número de cama es obligatorio";
	const dni = onlyDigits(f.trabajadorDni);
	if (dni && !((dni.length >= 7 && dni.length <= 9) || dni.length === 11))
		e.trabajadorDni =
			"Documento inválido (7-9 dígitos para DNI u 11 para CUIL)";
	const tel = onlyDigits(f.trabajadorTelefono);
	if (!tel) e.trabajadorTelefono = "El teléfono es obligatorio";
	else if (tel.length < 8)
		e.trabajadorTelefono = "Teléfono inválido (mínimo 8 dígitos)";
	if (!f.trabajadorSexo) e.trabajadorSexo = "El sexo es obligatorio";
	else if (!["M", "F"].includes(f.trabajadorSexo))
		e.trabajadorSexo = "Sexo inválido";
	const d = onlyDigits(f.diaIngreso);
	const m = onlyDigits(f.mesIngreso);
	const a = onlyDigits(f.anioIngreso);
	if (d && (Number(d) < 1 || Number(d) > 31))
		e.diaIngreso = "Día inválido (01-31)";
	if (m && (Number(m) < 1 || Number(m) > 12))
		e.mesIngreso = "Mes inválido (01-12)";
	if (a && a.length !== 2 && a.length !== 4)
		e.anioIngreso = "Año debe ser 2 o 4 dígitos";
	const nd = onlyDigits(f.trabajadorNacimientoDia);
	const nm = onlyDigits(f.trabajadorNacimientoMes);
	const na = onlyDigits(f.trabajadorNacimientoAnio);
	if (nd && (Number(nd) < 1 || Number(nd) > 31))
		e.trabajadorNacimientoDia = "Día inválido";
	if (nm && (Number(nm) < 1 || Number(nm) > 12))
		e.trabajadorNacimientoMes = "Mes inválido";
	if (na && na.length !== 4)
		e.trabajadorNacimientoAnio = "Usá 4 dígitos (ej: 1995)";
	return e;
}

export function cx(...cls) {
	return cls.filter(Boolean).join(" ");
}

export function Section({ title, subtitle, children }) {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<div>
					<h3 className={styles.sectionTitle}>{title}</h3>
					{subtitle && (
						<div className={styles.sectionHint}>{subtitle}</div>
					)}
				</div>
			</div>
			{children}
		</section>
	);
}

export function DatePartInput({
	label,
	value,
	onChange,
	onBlur,
	placeholder,
	maxLength,
	error,
	className,
}) {
	return (
		<div className={cx(styles.datePartField, className)}>
			<label className={styles.label}>{label}</label>
			<input
				className={cx(styles.input, error && styles.inputError)}
				value={value}
				onChange={onChange}
				onBlur={onBlur}
				inputMode="numeric"
				placeholder={placeholder}
				maxLength={maxLength}
			/>
			{error && <div className={styles.errorText}>{error}</div>}
		</div>
	);
}

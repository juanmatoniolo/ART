// utils/calculos.js

/**
 * ============================================================================
 * Helpers numéricos / formateo
 * ============================================================================
 */

export const parseNumber = (val) => {
	if (val == null || val === "") return 0;
	if (typeof val === "number") return Number.isFinite(val) ? val : 0;

	let s = String(val)
		.trim()
		.replace(/[^\d.,-]/g, "");

	if (s.includes(",") && s.includes(".")) {
		const lastComma = s.lastIndexOf(",");
		const lastDot = s.lastIndexOf(".");
		if (lastComma > lastDot) {
			s = s.replace(/\./g, "").replace(",", ".");
		} else {
			s = s.replace(/,/g, "");
		}
	} else if (s.includes(",")) {
		s = s.replace(",", ".");
	}

	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
};

export const money = (n) => {
	if (n == null || n === "" || n === "-") return "—";
	const num = typeof n === "number" ? n : parseNumber(n);
	return Number.isFinite(num)
		? num.toLocaleString("es-AR", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})
		: "—";
};

export const normalize = (s) =>
	(s ?? "")
		.toString()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

export const normalizeCodeDigits = (code) =>
	String(code ?? "").replace(/\D/g, "");

/**
 * ============================================================================
 * Flags / utilidades del nomenclador
 * ============================================================================
 */

export const isRadiografia = (item) => {
	const d = normalize(item?.descripcion || "");
	return d.includes("radiograf") || d.includes("rx");
};

export const isSubsiguiente = (item) => {
	const d = normalize(item?.descripcion || "");
	return (
		d.includes("por exposicion subsiguiente") ||
		d.includes("por exposición subsiguiente")
	);
};

export const vincularSubsiguientes = (item, data) => {
	const idx = data.findIndex((d) =>
		item.__key ? d.__key === item.__key : d.codigo === item.codigo,
	);
	if (idx === -1) return [item];

	const prev = data[idx - 1];
	const next = data[idx + 1];

	if (isSubsiguiente(item) && prev) return [prev, item];
	if (next && isSubsiguiente(next)) return [item, next];

	return [item];
};

export const escapeRegExp = (s) =>
	String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const highlight = (text, q) => {
	if (!text || !q) return text;
	const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
	return String(text)
		.split(regex)
		.map((part, i) =>
			part.toLowerCase() === String(q).toLowerCase() ? (
				<mark key={i} className="highlight">
					{part}
				</mark>
			) : (
				part
			),
		);
};

/**
 * ============================================================================
 * PRÁCTICAS ESPECIALES (valores FIJOS del convenio)
 * ============================================================================
 */

const buscarValor = (valoresConvenio, claves, defaultValue = null) => {
	for (const clave of claves) {
		const v = valoresConvenio?.[clave];
		if (v !== null && v !== undefined && v !== "") return parseNumber(v);
	}
	return defaultValue;
};

const codigoEs = (practicaCodigo, esperado) => {
	const a = normalizeCodeDigits(practicaCodigo);
	const b = normalizeCodeDigits(esperado);
	return a !== "" && a === b;
};

function esPracticaEspecial(practica, valoresConvenio) {
	const cod = String(practica?.codigo || "").trim();
	const desc = normalize(practica?.descripcion || "");

	/**
	 * ✅ NUEVA REGLA
	 * 43.01.01 / 43.10.01 / 43.11.01
	 * - NO llevan honorarios médicos
	 * - SOLO GASTO
	 * - gasto = gto * diaPension (del convenio)
	 */
	const ES_PENSION_POR_GTO =
		codigoEs(cod, "43.01.01") ||
		codigoEs(cod, "43.10.01") ||
		codigoEs(cod, "43.11.01");

	if (ES_PENSION_POR_GTO) {
		const diaPension =
			buscarValor(
				valoresConvenio,
				[
					"diaPension",
					"pension",
					"pensionDia",
					"DiaPension",
					"Pension",
				],
				0,
			) || 0;

		const gto = parseNumber(practica?.gto || 0);
		const gasto = gto * diaPension;

		return {
			honorario: 0,
			gasto,
			soloHonorario: false,
			soloGasto: true,
			label: "Pensión (gto × díaPensión)",
			baseInfo: { key: "diaPension", value: diaPension },
		};
	}

	// 1) Consulta
	const ES_CONSULTA =
		codigoEs(cod, "42.01.01") ||
		desc.includes("consulta") ||
		cod.toLowerCase() === "consulta";
	if (ES_CONSULTA) {
		const valor = buscarValor(
			valoresConvenio,
			["consulta", "Consulta", "CONSULTA"],
			null,
		);
		if (valor !== null) {
			return {
				honorario: valor,
				gasto: 0,
				soloHonorario: true,
				soloGasto: false,
				label: "Consulta (valor fijo convenio)",
				baseInfo: { key: "consulta", value: valor },
			};
		}
	}

	// 2) Curaciones (43.02.01 / 430201)
	const ES_CURACION =
		codigoEs(cod, "43.02.01") ||
		codigoEs(cod, "430201") ||
		desc === "curaciones" ||
		desc.includes("curacion") ||
		desc.includes("curación");

	if (ES_CURACION) {
		const valor = buscarValor(
			valoresConvenio,
			[
				"Curaciones_R",
				"CURACIONES_R",
				"Curaciones",
				"curaciones",
				"Curacion",
				"Curación",
			],
			null,
		);

		if (valor !== null) {
			return {
				honorario: 0,
				gasto: valor,
				soloHonorario: false,
				soloGasto: true,
				label: "Curaciones (valor fijo convenio)",
				baseInfo: { key: "Curaciones_R", value: valor },
			};
		}
	}

	// 3) ECG (ejemplos)
	const ES_ECG =
		cod.includes("17.01.01") ||
		cod.includes("42.03.03") ||
		desc.includes("ecg") ||
		desc.includes("electro");
	if (ES_ECG) {
		const valor = buscarValor(
			valoresConvenio,
			[
				"ECG Y EX EN CV",
				"ECG",
				"electrocardiograma",
				"Electrocardiograma",
			],
			null,
		);
		if (valor !== null) {
			return {
				honorario: valor,
				gasto: 0,
				soloHonorario: true,
				soloGasto: false,
				label: "ECG (valor fijo convenio)",
				baseInfo: { key: "ECG", value: valor },
			};
		}
	}

	// 4) ECO partes blandas (ejemplo)
	const ES_ECO_PARTES =
		cod.includes("18.06.01") || desc.includes("eco partes blandas");
	if (ES_ECO_PARTES) {
		const valor = buscarValor(
			valoresConvenio,
			[
				"Ecografia Partes Blandas No Moduladas",
				"Ecografia Partes Blandas",
			],
			null,
		);
		if (valor !== null) {
			return {
				honorario: valor,
				gasto: 0,
				soloHonorario: true,
				soloGasto: false,
				label: "Eco Partes Blandas (valor fijo convenio)",
				baseInfo: { key: "Ecografia Partes Blandas", value: valor },
			};
		}
	}

	// 5) Artroscopia (ejemplo)
	const ES_ARTROSCOPIA =
		cod.includes("120902") || desc.includes("artroscopia");
	if (ES_ARTROSCOPIA) {
		if (desc.includes("hombro")) {
			const valor = buscarValor(
				valoresConvenio,
				["Artroscopia Hombro", "Artroscopia Hombro (total)"],
				null,
			);
			if (valor !== null) {
				const honorario = Math.round(valor * 0.7);
				const gasto = valor - honorario;
				return {
					honorario,
					gasto,
					soloHonorario: false,
					soloGasto: false,
					label: "Artroscopia hombro (valor fijo convenio)",
					baseInfo: { key: "Artroscopia Hombro", value: valor },
				};
			}
		}

		if (desc.includes("simple")) {
			const valor = buscarValor(
				valoresConvenio,
				[
					"Artroscopia Simple Gastoss Sanatoriales",
					"Artroscopia Simple Gastos",
				],
				null,
			);
			if (valor !== null) {
				return {
					honorario: 0,
					gasto: valor,
					soloHonorario: false,
					soloGasto: true,
					label: "Artroscopia simple (solo gasto fijo)",
					baseInfo: { key: "Artroscopia Simple", value: valor },
				};
			}
		}
	}

	// 6) FKT (ejemplo)
	const ES_FKT = desc.includes("fkt");
	if (ES_FKT) {
		const valor = buscarValor(valoresConvenio, ["FKT", "fkt"], null);
		if (valor !== null) {
			return {
				honorario: 0,
				gasto: valor,
				soloHonorario: false,
				soloGasto: true,
				label: "FKT (valor fijo convenio)",
				baseInfo: { key: "FKT", value: valor },
			};
		}
	}

	return null;
}

/**
 * ============================================================================
 * CÁLCULO DE PRÁCTICAS
 * ============================================================================
 */
export const calcularPractica = (practica, valoresConvenio) => {
	const defaults = {
		galenoRx: 0,
		gastoRx: 0,
		galenoQuir: 0,
		gastoOperatorio: 0,
		otrosGastos: 0,
	};

	const v = { ...defaults, ...(valoresConvenio || {}) };

	// 1) Especiales
	const especial = esPracticaEspecial(practica, v);
	if (especial) {
		const total = (especial.honorario || 0) + (especial.gasto || 0);

		return {
			honorarioMedico: especial.honorario,
			gastoSanatorial: especial.gasto,
			total,
			formula: especial.label
				? `${especial.label}: ${money(especial.honorario)} + ${money(especial.gasto)}`
				: `Especial: ${money(especial.honorario)} + ${money(especial.gasto)}`,
			soloHonorario: especial.soloHonorario,
			soloGasto: especial.soloGasto,
			meta: {
				kind: "especial",
				baseKey: especial.baseInfo?.key,
				baseValue: especial.baseInfo?.value,
				codigoNormalizado: normalizeCodeDigits(practica?.codigo),
			},
		};
	}

	// 2) No especial: usamos qgal y gto
	const qgal = parseNumber(practica.qgal || practica.q_gal || 0);
	const gto = parseNumber(practica.gto || 0);

	// RX
	if (isRadiografia(practica)) {
		const gastoOp = (parseNumber(v.gastoRx) * gto) / 2;
		const honorario = parseNumber(v.galenoRx) * qgal + gastoOp;

		return {
			honorarioMedico: honorario,
			gastoSanatorial: gastoOp,
			total: honorario + gastoOp,
			formula: `RX: (${money(v.galenoRx)} × ${money(qgal)}) + ((${money(v.gastoRx)} × ${money(gto)}) / 2)`,
			soloHonorario: false,
			soloGasto: false,
			meta: {
				kind: "rx",
				qgal,
				gto,
				galenoBase: parseNumber(v.galenoRx),
				gastoBase: parseNumber(v.gastoRx),
			},
		};
	}

	// Cirugías (cap 12/13)
	const capituloNum =
		Number(String(practica.capitulo || "").replace(/\D/g, "")) || 0;
	if (capituloNum === 12 || capituloNum === 13) {
		const honorario = parseNumber(v.galenoQuir) * qgal;
		const gasto = parseNumber(v.gastoOperatorio) * gto;

		return {
			honorarioMedico: honorario,
			gastoSanatorial: gasto,
			total: honorario + gasto,
			formula: `Cirugía: (${money(v.galenoQuir)} × ${money(qgal)}) + (${money(v.gastoOperatorio)} × ${money(gto)})`,
			soloHonorario: false,
			soloGasto: false,
			meta: {
				kind: "cirugia",
				qgal,
				gto,
				galenoBase: parseNumber(v.galenoQuir),
				gastoBase: parseNumber(v.gastoOperatorio),
			},
		};
	}

	// Otras prácticas (directo)
	const honorario = qgal * parseNumber(v.otrosGastos);
	const gasto = gto * parseNumber(v.otrosGastos);

	return {
		honorarioMedico: honorario,
		gastoSanatorial: gasto,
		total: honorario + gasto,
		formula: `Directo: (${money(qgal)} × ${money(v.otrosGastos)}) + (${money(gto)} × ${money(v.otrosGastos)})`,
		soloHonorario: false,
		soloGasto: false,
		meta: {
			kind: "directo",
			qgal,
			gto,
			base: parseNumber(v.otrosGastos),
		},
	};
};

/**
 * ============================================================================
 * LABORATORIO
 * ============================================================================
 */
export const calcularLaboratorio = (laboratorio, valoresConvenio) => {
	const { valorUB = 0 } = valoresConvenio || {};
	const ub = parseNumber(laboratorio.unidadBioquimica || 0);
	const total = ub * parseNumber(valorUB);

	return {
		valorUB: parseNumber(valorUB),
		valorCalculado: total,
		total,
		formula: `${money(ub)} × ${money(valorUB)}`,
	};
};

/**
 * ============================================================================
 * PENSIÓN
 * ============================================================================
 */
export const calcularPension = (dias, valoresConvenio) => {
	const pension = parseNumber(valoresConvenio?.pension ?? 0);
	const d = parseNumber(dias);
	const total = pension * d;

	return {
		pension,
		dias: d,
		total,
		formula: `${money(pension)} × ${money(d)}`,
	};
};

/**
 * ============================================================================
 * AOTER
 * ============================================================================
 */
export const obtenerHonorariosAoter = (complejidad, valoresConvenio) => {
	const nivel = Number(complejidad) || 0;
	const honorarios = valoresConvenio?.honorarios_medicos;

	if (!Array.isArray(honorarios) || nivel < 1 || nivel > honorarios.length) {
		return { cirujano: 0, ayudante1: 0, ayudante2: 0 };
	}

	const item = honorarios[nivel - 1];

	const toNumber = (val) => {
		if (val === "NO" || val === "-" || val === "") return 0;
		const num = parseNumber(val);
		return Number.isFinite(num) ? num : 0;
	};

	return {
		cirujano: toNumber(item?.Cirujano),
		ayudante1: toNumber(item?.Ayudante_1),
		ayudante2: toNumber(item?.Ayudante_2),
	};
};

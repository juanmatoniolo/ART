// lib/pami/presupuestos.js
import { db } from "@/lib/firebase";
import { ref, push, set, update, remove } from "firebase/database";

const PATH = "PAMI/pacientes";

/* ─── Presentaciones ─── */
export const PRESENTACIONES = {
	medicamentos: {
		ampolla: "Ampolla",
		vial: "Vial",
		tabletas: "Tabletas",
		frasco: "Frasco",
		bolsa: "Bolsa",
		jeringa: "Jeringa",
		gasas: "Gasas",
		tubo: "Tubo",
		tiras: "Tiras",
	},
	descartables: {
		unidad: "Unidad",
		rollo: "Rollo",
		juego: "Juego",
		bolsa: "Bolsa",
		frasco: "Frasco",
		kit: "Kit",
		set: "Set",
		tubo: "Tubo",
	},
};
export const labelPresentacion = (cat, v) => PRESENTACIONES[cat]?.[v] || v;

/* ─── Accesores ─── */
export const itemsDe = (b) =>
	Array.isArray(b.items) ? b.items : Object.values(b.items || {});
export const codigosDe = (b) =>
	Array.isArray(b.codigos) ? b.codigos : Object.values(b.codigos || {});

/* ─── Parseadores ─── */
export const parseCantidad = (v, fallback = 0) => {
	if (typeof v === "number")
		return Number.isFinite(v) && v >= 0 ? v : fallback;
	const n = parseFloat(
		String(v ?? "")
			.trim()
			.replace(",", "."),
	);
	return Number.isFinite(n) && n >= 0 ? n : fallback;
};
export const fmtCantidad = (n) => {
	const num = Number(n);
	return Number.isFinite(num) && num > 0 ? String(num) : "0";
};
export const parseMonto = (v) => {
	const n = parseFloat(
		String(v ?? "")
			.trim()
			.replace(",", "."),
	);
	return Number.isFinite(n) && n > 0 ? n : 0;
};

/* ─── Totales ─── */
export const totalDe = (b) => {
	if (b.total != null) return Number(b.total);
	const iT = itemsDe(b).reduce(
		(s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0),
		0,
	);
	const cT = codigosDe(b).reduce((s, c) => s + (Number(c.monto) || 0), 0);
	return iT + cT;
};

/* ─── CRUD ─── */
export async function guardarPresupuestoPami(
	pacienteKey,
	presupuesto,
	{ usuario = "sistema", id = null } = {},
) {
	const now = Date.now();
	const data = {
		items: presupuesto.items || [],
		codigos: presupuesto.codigos || [],
		total: presupuesto.total || 0,
		oncoplan: !!presupuesto.oncoplan,
		opId: presupuesto.opId || null,
		internacionId: presupuesto.internacionId || null,
		cirugiaId: presupuesto.cirugiaId || null,
		estado: "borrador",
		modifiedBy: usuario,
		updatedAt: now,
	};
	if (id) {
		await update(
			ref(db, `${PATH}/${pacienteKey}/medicamentos/${id}`),
			data,
		);
		return { id };
	}
	const nuevo = push(ref(db, `${PATH}/${pacienteKey}/medicamentos`));
	await set(nuevo, { ...data, createdBy: usuario, createdAt: now });
	return { id: nuevo.key };
}

export const eliminarPresupuestoPami = (pacienteKey, id) =>
	remove(ref(db, `${PATH}/${pacienteKey}/medicamentos/${id}`));

/* ─── Listados ─── */
export const listarBorradoresPaciente = (paciente) => {
	const meds = paciente?.medicamentos || {};
	return Object.entries(meds)
		.map(([id, v]) => ({
			id,
			...v,
			itemsCount: itemsDe(v).length,
			codigosCount: codigosDe(v).length,
			total: totalDe(v),
			fechaMs: Number(v.createdAt || v.updatedAt || 0),
			oncoplan: !!v.oncoplan,
		}))
		.sort((a, b) => b.fechaMs - a.fechaMs);
};

export const listarBorradoresGlobales = (pacientesDb) => {
	const lista = [];
	for (const pac of pacientesDb) {
		for (const [id, b] of Object.entries(pac.medicamentos || {})) {
			lista.push({
				id,
				pacienteDni: pac.dni,
				pacienteNombre: [pac.apellido, pac.nombre]
					.filter(Boolean)
					.join(" "),
				pacienteAfiliado: pac.afiliado || "",
				fechaMs: Number(b.createdAt || b.updatedAt || 0),
				itemsCount: itemsDe(b).length,
				codigosCount: codigosDe(b).length,
				total: totalDe(b),
				oncoplan: !!b.oncoplan,
				opId: b.opId || null,
				internacionId: b.internacionId || null,
				cirugiaId: b.cirugiaId || null,
				raw: b,
			});
		}
	}
	return lista.sort((a, b) => b.fechaMs - a.fechaMs);
};

/* ─── Estadísticas (función pura) ─── */
export function calcularEstadisticas(
	pacientesDb,
	{
		desde = "",
		hasta = "",
		edadDesde = "",
		edadHasta = "",
		filtroCategoria = "todos",
		filtroOncoplan = "todos",
	} = {},
) {
	const hoy = new Date();
	const registros = [];

	for (const paciente of pacientesDb) {
		const nacimiento = paciente.fechaNacimiento
			? new Date(`${paciente.fechaNacimiento}T00:00:00`)
			: null;
		const edad =
			nacimiento && !Number.isNaN(nacimiento.getTime())
				? Math.max(
						0,
						hoy.getFullYear() -
							nacimiento.getFullYear() -
							(hoy.getMonth() < nacimiento.getMonth() ||
							(hoy.getMonth() === nacimiento.getMonth() &&
								hoy.getDate() < nacimiento.getDate())
								? 1
								: 0),
					)
				: null;

		for (const [id, b] of Object.entries(paciente.medicamentos || {})) {
			const fechaMs = Number(b.createdAt || b.updatedAt || 0);
			const fecha = fechaMs ? new Date(fechaMs) : null;
			const fechaISOreg = fecha
				? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
				: "";
			if (desde && (!fechaISOreg || fechaISOreg < desde)) continue;
			if (hasta && (!fechaISOreg || fechaISOreg > hasta)) continue;
			if (edadDesde !== "" && (edad === null || edad < Number(edadDesde)))
				continue;
			if (edadHasta !== "" && (edad === null || edad > Number(edadHasta)))
				continue;
			if (filtroOncoplan === "oncoplan" && !b.oncoplan) continue;
			if (filtroOncoplan === "normal" && b.oncoplan) continue;

			const itemsB = itemsDe(b);
			const filtrados = itemsB.filter(
				(i) =>
					filtroCategoria === "todos" ||
					i.categoria === filtroCategoria ||
					(filtroCategoria === "medicamentos" &&
						i.tipo === "medicamento") ||
					(filtroCategoria === "descartables" &&
						i.tipo === "descartable"),
			);
			if (!filtrados.length) continue;

			registros.push({
				id,
				dni: paciente.dni,
				paciente,
				fechaMs,
				edad,
				items: filtrados,
				total: filtrados.reduce(
					(s, i) =>
						s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0),
					0,
				),
				oncoplan: !!b.oncoplan,
			});
		}
	}

	const productos = {};
	let medicamentos = 0,
		descartables = 0,
		unidades = 0;
	for (const r of registros) {
		for (const i of r.items) {
			const subtotal =
				(Number(i.precio) || 0) * (Number(i.cantidad) || 0);
			const cat =
				i.categoria ||
				(i.tipo === "medicamento" ? "medicamentos" : "descartables");
			if (cat === "medicamentos" || i.tipo === "medicamento")
				medicamentos += subtotal;
			else descartables += subtotal;
			unidades += Number(i.cantidad) || 0;
			const key = i.nombre || i.key || "Sin nombre";
			productos[key] ||= { nombre: key, cantidad: 0, total: 0 };
			productos[key].cantidad += Number(i.cantidad) || 0;
			productos[key].total += subtotal;
		}
	}

	const total = registros.reduce((s, r) => s + r.total, 0);
	const pacientesUnicos = new Set(registros.map((r) => r.dni).filter(Boolean))
		.size;
	const porMes = {};
	for (const r of registros) {
		if (!r.fechaMs) continue;
		const d = new Date(r.fechaMs);
		const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		porMes[k] = (porMes[k] || 0) + r.total;
	}

	let oncoplanCount = 0,
		oncoplanTotal = 0,
		normalCount = 0,
		normalTotal = 0;
	for (const r of registros) {
		if (r.oncoplan) {
			oncoplanCount++;
			oncoplanTotal += r.total;
		} else {
			normalCount++;
			normalTotal += r.total;
		}
	}

	return {
		registros,
		total,
		medicamentos,
		descartables,
		unidades,
		pacientesUnicos,
		promedio: pacientesUnicos ? total / pacientesUnicos : 0,
		top: Object.values(productos)
			.sort((a, b) => b.cantidad - a.cantidad)
			.slice(0, 8),
		porMes: Object.entries(porMes)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.slice(-8),
		oncoplanCount,
		oncoplanTotal,
		normalCount,
		normalTotal,
	};
}

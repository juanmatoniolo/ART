"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ref, push, update, remove, onValue, get } from "firebase/database";

// ⚠️ AJUSTÁ ESTA RUTA a donde exportás tu instancia de Realtime Database.
import { db } from "@/lib/firebase";

import { buildItemKey, formatFecha, getFechaLegible } from "../utils/farmacia";

// Usuario que queda registrado en los movimientos.
// Si tenés auth, reemplazá por el usuario logueado.
const USUARIO_ACTUAL = "Farmacia";

const grupoDe = (tipo) =>
	tipo === "descartable" ? "descartables" : "medicamentos";

export default function useFarmacia() {
	const [medicamentos, setMedicamentos] = useState({});
	const [descartables, setDescartables] = useState({});
	const [ingresos, setIngresos] = useState({});
	const [repartos, setRepartos] = useState({});
	const [listasPrecios, setListasPrecios] = useState([]);
	const [mensaje, setMensaje] = useState(null);

	const mostrarMensaje = useCallback((tipo, titulo, msg) => {
		setMensaje({ tipo, titulo, mensaje: msg });
	}, []);
	const cerrarMensaje = useCallback(() => setMensaje(null), []);

	// ─── Suscripciones RTDB ────────────────────────────────────────────────
	useEffect(() => {
		const subs = [
			onValue(ref(db, "medydescartables/medicamentos"), (s) =>
				setMedicamentos(s.val() || {}),
			),
			onValue(ref(db, "medydescartables/descartables"), (s) =>
				setDescartables(s.val() || {}),
			),
			onValue(ref(db, "ingresos_farmacia"), (s) =>
				setIngresos(s.val() || {}),
			),
			onValue(ref(db, "repartos_farmacia"), (s) =>
				setRepartos(s.val() || {}),
			),
			onValue(ref(db, "listas_precios"), (s) => {
				const v = s.val() || {};
				setListasPrecios(
					Object.entries(v).map(([id, val]) => ({ id, ...val })),
				);
			}),
		];
		return () => subs.forEach((unsub) => unsub());
	}, []);

	// ─── items: array plano normalizado ───────────────────────────────────
	const items = useMemo(() => {
		const map = (obj, tipo) =>
			Object.entries(obj).map(([key, v]) => ({
				...v,
				id: key,
				tipo: v.tipo || tipo,
				tipoLabel:
					(v.tipo || tipo) === "medicamento"
						? "Medicamento"
						: "Descartable",
				precio: Number(v.precioReferencia) || 0,
				precioReferencia: Number(v.precioReferencia) || 0,
				stockActual: Number(v.stockActual) || 0,
				stockMinimo: Number(v.stockMinimo) || 0,
				activo: v.activo !== false,
			}));
		return [
			...map(medicamentos, "medicamento"),
			...map(descartables, "descartable"),
		].sort((a, b) => a.nombre.localeCompare(b.nombre));
	}, [medicamentos, descartables]);

	// ─── movimientos: ingresos + repartos unificados ──────────────────────
	const movimientos = useMemo(() => {
		const construir = (obj, tipo) =>
			Object.entries(obj).map(([id, m]) => {
				const ts = m.fecha
					? Date.parse(m.fecha)
					: m.timestamp || Date.now();
				const productos = m.productos || [];
				const totalUnidades = productos.reduce(
					(acc, p) => acc + (Number(p.cantidad) || 0),
					0,
				);
				const valorTotal = productos.reduce(
					(acc, p) =>
						acc +
						(Number(p.cantidad) || 0) *
							(Number(p.precioUnitario) || 0),
					0,
				);
				return {
					...m,
					id: m.id || id,
					tipo,
					productos,
					totalProductos: productos.length,
					totalUnidades,
					valorTotal,
					usuario: m.usuario || USUARIO_ACTUAL,
					fechaLegible: getFechaLegible(ts),
					fechaFormatted: formatFecha(ts),
					_ts: ts,
				};
			});
		return [
			...construir(ingresos, "ingreso"),
			...construir(repartos, "reparto"),
		].sort((a, b) => b._ts - a._ts);
	}, [ingresos, repartos]);

	// ─── estadísticas ─────────────────────────────────────────────────────
	const estadisticas = useMemo(() => {
		const activos = items.filter((i) => i.activo);
		return {
			totalItems: activos.length,
			itemsSinStock: activos.filter((i) => i.stockActual === 0).length,
			itemsBajoStock: activos.filter(
				(i) => i.stockActual > 0 && i.stockActual < i.stockMinimo,
			).length,
			valorTotalStock: activos.reduce(
				(acc, i) => acc + i.stockActual * i.precioReferencia,
				0,
			),
		};
	}, [items]);

	const itemsBajoStockList = useMemo(
		() =>
			items
				.filter((i) => i.activo && i.stockActual < i.stockMinimo)
				.sort(
					(a, b) =>
						a.stockActual / (a.stockMinimo || 1) -
						b.stockActual / (b.stockMinimo || 1),
				),
		[items],
	);

	// ─── Catálogo para Carga Masiva ───────────────────────────────────────
	const cargarCatalogo = useCallback(async () => {
		const snap = await get(ref(db, "medydescartables"));
		const data = snap.val() || {};
		const map = (obj = {}, tipo) =>
			Object.entries(obj)
				.map(([key, v]) => ({
					...v,
					id: key,
					tipo: v.tipo || tipo,
					tipoLabel:
						(v.tipo || tipo) === "medicamento"
							? "Medicamento"
							: "Descartable",
					precio: Number(v.precioReferencia) || 0,
					stockActual: Number(v.stockActual) || 0,
				}))
				.filter((i) => i.activo !== false);
		return [
			...map(data.medicamentos, "medicamento"),
			...map(data.descartables, "descartable"),
		].sort((a, b) => a.nombre.localeCompare(b.nombre));
	}, []);

	// ─── Agregar producto ─────────────────────────────────────────────────
	const agregarProducto = useCallback(
		async (form) => {
			try {
				const nombre = (form.nombre || "").trim();
				if (!nombre) {
					mostrarMensaje(
						"warning",
						"Falta el nombre",
						"Ingresá un nombre de producto.",
					);
					return false;
				}
				const precio = parseFloat(form.precio);
				if (!(precio > 0)) {
					mostrarMensaje(
						"warning",
						"Precio inválido",
						"El precio debe ser mayor a 0.",
					);
					return false;
				}

				const key = buildItemKey(nombre);
				const grupo = grupoDe(form.tipo);
				await update(ref(db, `medydescartables/${grupo}/${key}`), {
					activo: true,
					nombre: key,
					tipo: form.tipo,
					presentacion: form.presentacion || "unidad",
					precioReferencia: precio,
					stockActual: parseInt(form.stockActual) || 0,
					stockMinimo: parseInt(form.stockMinimo) || 10,
				});
				mostrarMensaje(
					"success",
					"Producto agregado",
					`${nombre} se cargó correctamente.`,
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo agregar el producto.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Editar producto ──────────────────────────────────────────────────
	const editarProducto = useCallback(
		async (item) => {
			try {
				const grupo = grupoDe(item.tipo);
				await update(ref(db, `medydescartables/${grupo}/${item.id}`), {
					nombre: item.nombre,
					tipo: item.tipo,
					presentacion: item.presentacion,
					precioReferencia:
						parseFloat(item.precio ?? item.precioReferencia) || 0,
					stockActual: parseInt(item.stockActual) || 0,
					stockMinimo: parseInt(item.stockMinimo) || 0,
				});
				mostrarMensaje(
					"success",
					"Producto actualizado",
					"Los cambios se guardaron.",
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo editar el producto.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Eliminar producto (baja lógica) ──────────────────────────────────
	const eliminarProducto = useCallback(
		async (item) => {
			try {
				const grupo = grupoDe(item.tipo);
				await update(ref(db, `medydescartables/${grupo}/${item.id}`), {
					activo: false,
				});
				mostrarMensaje(
					"success",
					"Producto eliminado",
					`${String(item.nombre).replace(/_/g, " ")} se dio de baja.`,
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo eliminar el producto.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Carga masiva (ingreso de stock) ──────────────────────────────────
	const procesarCargaMasiva = useCallback(
		async (seleccionados) => {
			try {
				if (!seleccionados?.length) return false;
				const ts = Date.now();
				const fecha = new Date(ts).toISOString();
				const ingresoId = `ingreso_${ts}`;
				const updates = {};
				const productos = [];

				seleccionados.forEach((p) => {
					const cantidad = parseInt(p.cantidad) || 0;
					if (cantidad <= 0) return;
					const stockAnterior = Number(p.stockAnterior) || 0;
					const stockNuevo = Number(
						p.stockNuevo ?? stockAnterior + cantidad,
					);
					const grupo = grupoDe(p.tipo);
					updates[`medydescartables/${grupo}/${p.id}/stockActual`] =
						stockNuevo;
					productos.push({
						cantidad,
						itemId: p.id,
						itemNombre: p.nombre,
						motivo: "Carga masiva",
						precioUnitario: Number(p.precio) || 0,
						presentacion: p.presentacion || "unidad",
						stockAnterior,
						stockNuevo,
						tipo: p.tipo,
					});
				});

				if (!productos.length) return false;
				updates[`ingresos_farmacia/${ingresoId}`] = {
					id: ingresoId,
					fecha,
					usuario: USUARIO_ACTUAL,
					productos,
				};
				await update(ref(db), updates);
				mostrarMensaje(
					"success",
					"Ingreso registrado",
					`${productos.length} productos cargados.`,
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo procesar la carga masiva.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Reparto (despacho a un sector) ───────────────────────────────────
	const procesarReparto = useCallback(
		async (productos, datos) => {
			try {
				if (!productos?.length) return false;
				const ts = Date.now();
				const fecha = new Date(ts).toISOString();
				const repartoId = `reparto_${ts}`;
				const updates = {};
				const lineas = [];

				for (const p of productos) {
					const cantidad =
						parseInt(p.cantidadReparto ?? p.cantidad) || 0;
					if (cantidad <= 0) continue;
					const stockAnterior = Number(p.stockAnterior) || 0;
					const stockNuevo = Math.max(0, stockAnterior - cantidad);
					const grupo = grupoDe(p.tipo);
					updates[`medydescartables/${grupo}/${p.id}/stockActual`] =
						stockNuevo;
					lineas.push({
						cantidad,
						itemId: p.id,
						itemNombre: p.nombre,
						precioUnitario: Number(p.precio) || 0,
						presentacion: p.presentacion || "unidad",
						stockAnterior,
						stockNuevo,
						tipo: p.tipo,
					});
				}

				if (!lineas.length) return false;
				updates[`repartos_farmacia/${repartoId}`] = {
					id: repartoId,
					fecha,
					destino: datos?.destino || "Sin destino",
					responsable: datos?.responsable || "",
					nota: datos?.nota?.trim() || "Sin observaciones",
					usuario: USUARIO_ACTUAL,
					productos: lineas,
				};
				await update(ref(db), updates);
				mostrarMensaje(
					"success",
					"Reparto registrado",
					`Despacho a ${datos?.destino} confirmado.`,
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo procesar el reparto.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Importar desde CSV/Excel ─────────────────────────────────────────
	const importarDesdeExcel = useCallback(
		async (productos) => {
			try {
				const validos = (productos || []).filter((p) => p.valido);
				if (!validos.length) {
					mostrarMensaje(
						"warning",
						"Sin datos válidos",
						"No hay filas válidas para importar.",
					);
					return false;
				}

				const updates = {};
				validos.forEach((p) => {
					const key = buildItemKey(p.nombre);
					const grupo = grupoDe(p.tipo);
					updates[`medydescartables/${grupo}/${key}`] = {
						activo: true,
						nombre: key,
						tipo: p.tipo,
						presentacion: p.presentacion || "unidad",
						precioReferencia: Number(p.precio) || 0,
						stockActual: parseInt(p.stockInicial) || 0,
						stockMinimo: parseInt(p.stockMinimo) || 10,
					};
				});
				await update(ref(db), updates);
				mostrarMensaje(
					"success",
					"Importación completa",
					`${validos.length} productos importados.`,
				);
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo importar el archivo.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Exportar inventario / movimientos (CSV, Excel-compatible) ────────
	const exportarDatos = useCallback(
		(opciones, movs = movimientos) => {
			const { tipo, incluirSinStock = true } = opciones || {};
			const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
			let headers = [],
				filas = [],
				nombreArchivo = "export.csv";

			if (tipo === "stock" || tipo === "stock_bajo") {
				let data = items.filter((i) => i.activo);
				if (tipo === "stock_bajo")
					data = data.filter((i) => i.stockActual < i.stockMinimo);
				if (!incluirSinStock)
					data = data.filter((i) => i.stockActual > 0);
				headers = [
					"Nombre",
					"Tipo",
					"Presentacion",
					"Costo",
					"Stock",
					"Stock minimo",
					"Valor total",
				];
				filas = data.map((i) => [
					String(i.nombre).replace(/_/g, " "),
					i.tipo,
					i.presentacion,
					i.precioReferencia,
					i.stockActual,
					i.stockMinimo,
					i.stockActual * i.precioReferencia,
				]);
				nombreArchivo =
					tipo === "stock_bajo" ? "stock_bajo.csv" : "inventario.csv";
			} else if (tipo === "movimientos") {
				headers = [
					"Fecha",
					"Tipo",
					"Destino",
					"Responsable",
					"Producto",
					"Cantidad",
					"Precio unitario",
					"Valor",
				];
				movs.forEach((m) => {
					(m.productos || []).forEach((p) => {
						filas.push([
							m.fechaFormatted,
							m.tipo,
							m.destino || "",
							m.responsable || "",
							String(p.itemNombre).replace(/_/g, " "),
							p.cantidad,
							p.precioUnitario,
							(Number(p.cantidad) || 0) *
								(Number(p.precioUnitario) || 0),
						]);
					});
				});
				nombreArchivo = "movimientos.csv";
			}

			const csv = [headers, ...filas]
				.map((f) => f.map(esc).join(";"))
				.join("\n");
			const blob = new Blob(["\uFEFF" + csv], {
				type: "text/csv;charset=utf-8;",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = nombreArchivo;
			link.click();
			URL.revokeObjectURL(link.href);
			mostrarMensaje(
				"success",
				"Exportado",
				`Se descargó ${nombreArchivo}.`,
			);
		},
		[items, movimientos, mostrarMensaje],
	);

	// ─── Listas de precios ────────────────────────────────────────────────
	const guardarListaPrecio = useCallback(
		async (lista) => {
			try {
				if (lista.id) {
					const { id, ...data } = lista;
					await update(ref(db, `listas_precios/${id}`), data);
				} else {
					await push(ref(db, "listas_precios"), lista);
				}
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo guardar la lista.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	const eliminarListaPrecio = useCallback(
		async (id) => {
			try {
				await remove(ref(db, `listas_precios/${id}`));
				return true;
			} catch (e) {
				console.error(e);
				mostrarMensaje(
					"error",
					"Error",
					"No se pudo eliminar la lista.",
				);
				return false;
			}
		},
		[mostrarMensaje],
	);

	// ─── Exportar listas de precios (una, varias o todas) ─────────────────
	const exportarListasPrecios = useCallback(
		(listaIds = [], data = items) => {
			const sel = listasPrecios
				.filter((l) => listaIds.includes(l.id))
				.sort((a, b) => (a.orden || 0) - (b.orden || 0));
			if (!sel.length) {
				mostrarMensaje(
					"warning",
					"Sin selección",
					"Elegí al menos una lista.",
				);
				return;
			}

			const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
			const headers = [
				"Producto",
				"Tipo",
				"Presentacion",
				"Costo",
				...sel.map((l) => `${l.nombre} (x${l.multiplicador})`),
			];
			const filas = data
				.filter((i) => i.activo)
				.map((i) => {
					const c = Number(i.precioReferencia) || 0;
					return [
						String(i.nombre).replace(/_/g, " "),
						i.tipo,
						i.presentacion,
						c,
						...sel.map((l) =>
							Math.round(c * Number(l.multiplicador || 1)),
						),
					];
				});

			const csv = [headers, ...filas]
				.map((f) => f.map(esc).join(";"))
				.join("\n");
			const blob = new Blob(["\uFEFF" + csv], {
				type: "text/csv;charset=utf-8;",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download =
				sel.length === 1
					? `precios_${sel[0].nombre}.csv`
					: "listas_precios.csv";
			link.click();
			URL.revokeObjectURL(link.href);
			mostrarMensaje(
				"success",
				"Exportado",
				`${sel.length} lista(s) exportada(s).`,
			);
		},
		[items, listasPrecios, mostrarMensaje],
	);

	// ─── API del hook ─────────────────────────────────────────────────────
	return {
		items,
		movimientos,
		estadisticas,
		itemsBajoStockList,
		mensaje,
		cerrarMensaje,
		agregarProducto,
		cargarCatalogo,
		procesarCargaMasiva,
		procesarReparto,
		editarProducto,
		eliminarProducto,
		importarDesdeExcel,
		exportarDatos,
		// precios
		listasPrecios,
		guardarListaPrecio,
		eliminarListaPrecio,
		exportarListasPrecios,
	};
}

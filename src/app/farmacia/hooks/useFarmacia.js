"use client";
import { useState, useEffect, useMemo } from "react";
import {
	ref,
	onValue,
	set,
	update,
	get,
	push,
	remove,
} from "firebase/database";
import { db } from "@/lib/firebase";
import {
	formatFecha,
	getFechaLegible,
	formatCurrency,
	buildItemKey,
} from "../utils/farmacia";

const USUARIO_ACTUAL = "Admin";

export default function useFarmacia() {
	const [items, setItems] = useState([]);
	const [movimientos, setMovimientos] = useState([]);
	const [mensaje, setMensaje] = useState(null); // { titulo, mensaje, tipo }

	const mostrarMensaje = (titulo, mensaje, tipo = "info") =>
		setMensaje({ titulo, mensaje, tipo });
	const cerrarMensaje = () => setMensaje(null);

	// ── Firebase listeners ──────────────────────────────────────────────────
	useEffect(() => {
		const refMeds = ref(db, "medydescartables/medicamentos");
		const refDesc = ref(db, "medydescartables/descartables");
		const refIngr = ref(db, "ingresos_farmacia");
		const refRep = ref(db, "repartos_farmacia");

		const unsubMeds = onValue(refMeds, (snapMeds) => {
			const medsData = snapMeds.exists() ? snapMeds.val() : {};
			const unsubDesc = onValue(refDesc, (snapDesc) => {
				const descData = snapDesc.exists() ? snapDesc.val() : {};
				const arr = [];

				Object.entries(medsData).forEach(([key, d]) =>
					arr.push({
						id: key,
						nombre: d.nombre || key,
						precio: d.precioReferencia || d.precio || 0,
						presentacion: d.presentacion || "ampolla",
						stockActual: d.stockActual || 0,
						stockMinimo: d.stockMinimo || 10,
						tipo: "medicamento",
						activo: d.activo !== false,
					}),
				);

				Object.entries(descData).forEach(([key, d]) =>
					arr.push({
						id: key,
						nombre: d.nombre || key,
						precio: d.precioReferencia || d.precio || 0,
						presentacion: d.presentacion || "unidad",
						stockActual: d.stockActual || 0,
						stockMinimo: d.stockMinimo || 10,
						tipo: "descartable",
						activo: d.activo !== false,
					}),
				);

				arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
				setItems(arr);
			});
			return () => unsubDesc();
		});

		const unsubIngr = onValue(refIngr, (snapI) => {
			const ingData = snapI.exists() ? snapI.val() : {};
			const unsubRep = onValue(refRep, (snapR) => {
				const repData = snapR.exists() ? snapR.val() : {};

				const mapMov = (data, tipo, icono) =>
					Object.entries(data)
						.map(([key, d]) => ({
							id: key,
							tipo,
							icono,
							...d,
							fecha: d.timestamp || key,
							fechaFormatted: formatFecha(d.timestamp || key),
							fechaLegible: getFechaLegible(d.timestamp || key),
						}))
						.filter((m) => m.fecha);

				const combined = [
					...mapMov(ingData, "ingreso", "📥"),
					...mapMov(repData, "reparto", "🚚"),
				]
					.sort((a, b) => b.fecha - a.fecha)
					.slice(0, 60);
				setMovimientos(combined);
			});
			return () => unsubRep();
		});

		return () => {
			unsubMeds();
			unsubIngr();
		};
	}, []);

	// ── Stats ───────────────────────────────────────────────────────────────
	const estadisticas = useMemo(() => {
		const totalItems = items.length;
		const itemsBajoStock = items.filter(
			(i) => i.stockActual < i.stockMinimo,
		).length;
		const itemsSinStock = items.filter((i) => i.stockActual === 0).length;
		const valorTotalStock = items.reduce(
			(s, i) => s + i.stockActual * i.precio,
			0,
		);
		return { totalItems, itemsBajoStock, itemsSinStock, valorTotalStock };
	}, [items]);

	const itemsBajoStockList = useMemo(
		() => items.filter((i) => i.stockActual < i.stockMinimo && i.activo),
		[items],
	);

	// ── Agregar producto ────────────────────────────────────────────────────
	const agregarProducto = async (nuevoProducto) => {
		const { nombre, tipo, presentacion, precio, stockActual, stockMinimo } =
			nuevoProducto;
		if (!nombre.trim() || !precio || parseFloat(precio) <= 0) {
			mostrarMensaje(
				"Campos requeridos",
				"Complete todos los campos requeridos",
				"warning",
			);
			return false;
		}
		try {
			const key = buildItemKey(nombre);
			const path = `medydescartables/${tipo === "medicamento" ? "medicamentos" : "descartables"}/${key}`;
			await set(ref(db, path), {
				nombre,
				tipo,
				presentacion,
				precioReferencia: parseFloat(precio),
				stockActual: parseInt(stockActual) || 0,
				stockMinimo: parseInt(stockMinimo) || 10,
				activo: true,
			});

			if (parseInt(stockActual) > 0) {
				const ts = Date.now();
				await set(ref(db, `ingresos_farmacia/ingreso_${ts}`), {
					id: `ingreso_${ts}`,
					timestamp: ts,
					fecha: new Date(ts).toISOString(),
					usuario: USUARIO_ACTUAL,
					productos: [
						{
							itemId: key,
							itemNombre: nombre,
							tipo,
							presentacion,
							cantidad: parseInt(stockActual),
							precioUnitario: parseFloat(precio),
							stockAnterior: 0,
							stockNuevo: parseInt(stockActual),
							motivo: "Stock inicial",
						},
					],
					totalProductos: 1,
					totalUnidades: parseInt(stockActual),
				});
			}
			mostrarMensaje(
				"Éxito",
				"Producto agregado exitosamente",
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje("Error", "No se pudo agregar el producto", "error");
			return false;
		}
	};

	// ── Carga masiva ────────────────────────────────────────────────────────
	const cargarCatalogo = async () => {
		const [snapMeds, snapDesc] = await Promise.all([
			get(ref(db, "medydescartables/medicamentos")),
			get(ref(db, "medydescartables/descartables")),
		]);
		const catalogoItems = [];
		if (snapMeds.exists())
			Object.entries(snapMeds.val()).forEach(([key, d]) =>
				catalogoItems.push({
					id: key,
					nombre: d.nombre || key,
					precio: d.precioReferencia || d.precio || 0,
					presentacion: d.presentacion || "ampolla",
					tipo: "medicamento",
					tipoLabel: "💊 Medicamento",
					stockActual: d.stockActual || 0,
					stockMinimo: d.stockMinimo || 10,
				}),
			);
		if (snapDesc.exists())
			Object.entries(snapDesc.val()).forEach(([key, d]) =>
				catalogoItems.push({
					id: key,
					nombre: d.nombre || key,
					precio: d.precioReferencia || d.precio || 0,
					presentacion: d.presentacion || "unidad",
					tipo: "descartable",
					tipoLabel: "🧷 Descartable",
					stockActual: d.stockActual || 0,
					stockMinimo: d.stockMinimo || 10,
				}),
			);
		return catalogoItems.sort((a, b) => a.nombre.localeCompare(b.nombre));
	};

	const procesarCargaMasiva = async (productosCarga) => {
		if (productosCarga.length === 0) {
			mostrarMensaje(
				"Sin productos",
				"Agregue al menos un producto",
				"warning",
			);
			return false;
		}
		try {
			const ts = Date.now();
			const updates = {};
			const productosIngreso = [];
			let totalUnidades = 0,
				valorTotal = 0;

			for (const p of productosCarga) {
				const cantidad = parseInt(p.cantidad) || 1;
				if (cantidad <= 0) continue;
				totalUnidades += cantidad;
				valorTotal += cantidad * p.precio;
				productosIngreso.push({
					itemId: p.id,
					itemNombre: p.nombre,
					tipo: p.tipo,
					presentacion: p.presentacion,
					cantidad,
					precioUnitario: p.precio,
					stockAnterior: p.stockAnterior || 0,
					stockNuevo: (p.stockAnterior || 0) + cantidad,
					motivo: "Carga masiva",
				});
				const path = `medydescartables/${p.tipo === "medicamento" ? "medicamentos" : "descartables"}/${p.id}`;
				updates[`${path}/stockActual`] =
					(p.stockAnterior || 0) + cantidad;
			}

			updates[`ingresos_farmacia/ingreso_${ts}`] = {
				id: `ingreso_${ts}`,
				timestamp: ts,
				fecha: new Date(ts).toISOString(),
				usuario: USUARIO_ACTUAL,
				productos: productosIngreso,
				totalProductos: productosIngreso.length,
				totalUnidades,
				valorTotal,
			};
			await update(ref(db), updates);
			mostrarMensaje(
				"Carga exitosa",
				`${productosCarga.length} productos ingresados. Valor: ${formatCurrency(valorTotal)}`,
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje("Error", "Error al procesar carga masiva", "error");
			return false;
		}
	};

	// ── Reparto ─────────────────────────────────────────────────────────────
	const procesarReparto = async (productosReparto, repartoData) => {
		if (productosReparto.length === 0) {
			mostrarMensaje(
				"Sin productos",
				"Agregue al menos un producto",
				"warning",
			);
			return false;
		}
		if (!repartoData.responsable.trim()) {
			mostrarMensaje(
				"Campo requerido",
				"Ingrese el nombre del responsable",
				"warning",
			);
			return false;
		}
		try {
			const ts = Date.now();
			const updates = {};
			const productosData = [];
			let totalUnidades = 0,
				valorTotal = 0;

			for (const p of productosReparto) {
				const cantidad = parseInt(p.cantidadReparto) || 0;
				if (cantidad <= 0) continue;
				totalUnidades += cantidad;
				valorTotal += cantidad * p.precio;
				productosData.push({
					itemId: p.id,
					itemNombre: p.nombre,
					tipo: p.tipo,
					presentacion: p.presentacion,
					cantidad,
					precioUnitario: p.precio,
					stockAnterior: p.stockAnterior,
					stockNuevo: p.stockNuevo,
					motivo: `Reparto a ${repartoData.destino}`,
				});
				const path = `medydescartables/${p.tipo === "medicamento" ? "medicamentos" : "descartables"}/${p.id}`;
				updates[`${path}/stockActual`] = p.stockNuevo;
			}

			updates[`repartos_farmacia/reparto_${ts}`] = {
				id: `reparto_${ts}`,
				timestamp: ts,
				fecha: new Date(ts).toISOString(),
				usuario: USUARIO_ACTUAL,
				...repartoData,
				nota: repartoData.nota || "Sin observaciones",
				productos: productosData,
				totalProductos: productosData.length,
				totalUnidades,
				valorTotal,
			};
			await update(ref(db), updates);
			mostrarMensaje(
				"Reparto exitoso",
				`${totalUnidades} unidades repartidas. Valor: ${formatCurrency(valorTotal)}`,
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje("Error", "Error al procesar reparto", "error");
			return false;
		}
	};

	// ── Exportar a CSV con formato correcto ─────────────────────────────────
	// ── Exportar a CSV con formato correcto (delimitador punto y coma, campos entre comillas) ──
	const exportarDatos = (opciones, movimientosList) => {
		let datos = [];
		let nombreArchivo = "";
		const { tipo, fechaInicio, fechaFin, incluirSinStock } = opciones;

		if (tipo === "stock") {
			datos = items.map((i) => ({
				Producto: i.nombre.replace(/_/g, " "),
				Tipo: i.tipo === "medicamento" ? "Medicamento" : "Descartable",
				Presentación: i.presentacion,
				"Stock Actual": i.stockActual,
				"Stock Mínimo": i.stockMinimo,
				"Precio Unitario (ARS)": i.precio,
				"Valor Total (ARS)": i.stockActual * i.precio,
			}));
			nombreArchivo = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
		} else if (tipo === "movimientos") {
			const filtrados =
				fechaInicio && fechaFin
					? movimientosList.filter((m) => {
							const f = new Date(m.fecha);
							const ini = new Date(fechaInicio);
							const fin = new Date(fechaFin);
							fin.setHours(23, 59, 59, 999);
							return f >= ini && f <= fin;
						})
					: movimientosList;
			datos = filtrados.flatMap(
				(m) =>
					m.productos?.map((p) => ({
						Fecha: m.fechaFormatted,
						Tipo: m.tipo === "ingreso" ? "Ingreso" : "Reparto",
						Usuario: m.usuario,
						Destino: m.destino || "N/A",
						Responsable: m.responsable || "N/A",
						Producto: p.itemNombre.replace(/_/g, " "),
						Cantidad: p.cantidad,
						"Precio Unitario (ARS)": p.precioUnitario,
						"Valor Total (ARS)": p.cantidad * p.precioUnitario,
						"Stock Anterior": p.stockAnterior,
						"Stock Nuevo": p.stockNuevo,
					})) || [],
			);
			nombreArchivo = `movimientos_${fechaInicio || "todos"}_${fechaFin || "hoy"}.csv`;
		} else if (tipo === "stock_bajo") {
			const filtrados = incluirSinStock
				? items.filter((i) => i.stockActual < i.stockMinimo)
				: items.filter(
						(i) =>
							i.stockActual > 0 && i.stockActual < i.stockMinimo,
					);
			datos = filtrados.map((i) => ({
				Producto: i.nombre.replace(/_/g, " "),
				"Stock Actual": i.stockActual,
				"Stock Mínimo": i.stockMinimo,
				Diferencia: i.stockMinimo - i.stockActual,
				"Valor a Comprar (ARS)":
					(i.stockMinimo - i.stockActual) * i.precio,
				Urgencia: i.stockActual === 0 ? "CRÍTICO" : "ALTO",
			}));
			nombreArchivo = `stock_bajo_${new Date().toISOString().slice(0, 10)}.csv`;
		}

		if (!datos.length) {
			mostrarMensaje(
				"Sin datos",
				"No hay datos para exportar",
				"warning",
			);
			return;
		}

		// Función que envuelve cualquier valor entre comillas dobles y escapa comillas internas
		const formatearCelda = (valor) => {
			if (valor === undefined || valor === null) return '""';
			let str = String(valor);
			// Reemplazar comillas dobles por dobles comillas (escapado CSV)
			str = str.replace(/"/g, '""');
			// Envolver entre comillas dobles
			return `"${str}"`;
		};

		const columnas = Object.keys(datos[0]);
		// Línea de encabezados: cada celda formateada, separada por punto y coma
		const cabecera = columnas.map(formatearCelda).join(";");
		// Filas de datos
		const filas = datos.map((fila) =>
			columnas.map((col) => formatearCelda(fila[col])).join(";"),
		);
		const csvContent = [cabecera, ...filas].join("\n");

		// Agregar BOM UTF-8 y usar punto y coma como separador
		const blob = new Blob(["\uFEFF" + csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = nombreArchivo;
		link.click();
		URL.revokeObjectURL(link.href);

		mostrarMensaje(
			"Exportación exitosa",
			`${datos.length} registros exportados a ${nombreArchivo}`,
			"success",
		);
	};

	// ── Editar producto ─────────────────────────────────────────────────────
	const editarProducto = async (item, cambios) => {
		try {
			const path = `medydescartables/${item.tipo === "medicamento" ? "medicamentos" : "descartables"}/${item.id}`;
			const updates = {};
			if (cambios.precio !== undefined)
				updates[`${path}/precioReferencia`] = parseFloat(
					cambios.precio,
				);
			if (cambios.stockMinimo !== undefined)
				updates[`${path}/stockMinimo`] = parseInt(cambios.stockMinimo);
			await update(ref(db), updates);
			mostrarMensaje(
				"Actualizado",
				"Producto actualizado correctamente",
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje(
				"Error",
				"No se pudo actualizar el producto",
				"error",
			);
			return false;
		}
	};

	// ── Eliminar producto ───────────────────────────────────────────────────
	const eliminarProducto = async (item) => {
		try {
			const path = `medydescartables/${item.tipo === "medicamento" ? "medicamentos" : "descartables"}/${item.id}`;
			await remove(ref(db, path));
			mostrarMensaje(
				"Eliminado",
				"Producto eliminado correctamente",
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje("Error", "No se pudo eliminar el producto", "error");
			return false;
		}
	};

	// ── Importar desde CSV ──────────────────────────────────────────────────
	const importarDesdeExcel = async (productos) => {
		const validos = productos.filter((p) => p.valido);
		if (!validos.length) {
			mostrarMensaje(
				"Sin datos",
				"No hay filas válidas para importar",
				"warning",
			);
			return false;
		}
		try {
			const ts = Date.now();
			const updates = {};
			const productosIngreso = [];
			let totalUnidades = 0,
				valorTotal = 0;

			for (const p of validos) {
				const key = buildItemKey(p.nombre);
				const subPath =
					p.tipo === "medicamento" ? "medicamentos" : "descartables";
				updates[`medydescartables/${subPath}/${key}`] = {
					nombre: p.nombre,
					tipo: p.tipo,
					presentacion: p.presentacion,
					precioReferencia: p.precio,
					stockActual: p.stockInicial,
					stockMinimo: p.stockMinimo,
					activo: true,
				};
				if (p.stockInicial > 0) {
					totalUnidades += p.stockInicial;
					valorTotal += p.stockInicial * p.precio;
					productosIngreso.push({
						itemId: key,
						itemNombre: p.nombre,
						tipo: p.tipo,
						presentacion: p.presentacion,
						cantidad: p.stockInicial,
						precioUnitario: p.precio,
						stockAnterior: 0,
						stockNuevo: p.stockInicial,
						motivo: "Importación masiva CSV",
					});
				}
			}

			if (productosIngreso.length) {
				updates[`ingresos_farmacia/ingreso_${ts}`] = {
					id: `ingreso_${ts}`,
					timestamp: ts,
					fecha: new Date(ts).toISOString(),
					usuario: "Admin",
					productos: productosIngreso,
					totalProductos: productosIngreso.length,
					totalUnidades,
					valorTotal,
				};
			}
			await update(ref(db), updates);
			mostrarMensaje(
				"Importación exitosa",
				`${validos.length} productos importados correctamente`,
				"success",
			);
			return true;
		} catch (e) {
			mostrarMensaje("Error", "Error al importar productos", "error");
			return false;
		}
	};

	return {
		items,
		movimientos,
		estadisticas,
		itemsBajoStockList,
		mensaje,
		mostrarMensaje,
		cerrarMensaje,
		agregarProducto,
		cargarCatalogo,
		procesarCargaMasiva,
		procesarReparto,
		exportarDatos,
		editarProducto,
		eliminarProducto,
		importarDesdeExcel,
	};
}

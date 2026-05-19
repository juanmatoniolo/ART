// utils/farmacia.js

export const normalizeText = (input) =>
	String(input ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/_/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const matchesAllTerms = (texto, busqueda) => {
	const t = normalizeText(texto);
	const q = normalizeText(busqueda);
	if (!q) return true;
	return q
		.split(" ")
		.filter(Boolean)
		.every((term) => t.includes(term));
};

export const formatFecha = (timestamp) =>
	new Date(timestamp).toLocaleDateString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

export const getFechaLegible = (timestamp) => {
	const diffMs = Date.now() - timestamp;
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);
	if (diffMins < 1) return "Hace unos segundos";
	if (diffMins < 60)
		return `Hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
	if (diffHours < 24)
		return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
	if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
	return formatFecha(timestamp);
};

export const formatCurrency = (amount) =>
	new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);

export const getStockColor = (stockActual, stockMinimo) => {
	if (stockActual === 0) return "#ef4444";
	if (stockActual < stockMinimo) return "#f59e0b";
	if (stockActual < stockMinimo * 2) return "#3b82f6";
	return "#10b981";
};

export const getStockStatus = (stockActual, stockMinimo) => {
	if (stockActual === 0) return "Sin stock";
	if (stockActual < stockMinimo) return "Bajo stock";
	if (stockActual < stockMinimo * 2) return "Moderado";
	return "Óptimo";
};

export const buildItemKey = (nombre) =>
	nombre
		.replace(/[.#$/[\]]/g, "")
		.replace(/\s+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "")
		.trim()
		.toUpperCase();

/**
 * Genera y descarga una plantilla CSV para importar productos.
 * Las columnas son: nombre, tipo, presentacion, precio, stockInicial, stockMinimo.
 * Escapa correctamente comas, comillas dobles y saltos de línea.
 * Incluye BOM UTF-8 para compatibilidad con Excel.
 */
export const generarPlantillaExcel = () => {
	const headers = [
		"nombre",
		"tipo",
		"presentacion",
		"precio",
		"stockInicial",
		"stockMinimo",
	];

	const ejemplos = [
		["Paracetamol 500mg", "medicamento", "ampolla", "1500", "10", "5"],
		["Amoxicilina 500mg", "medicamento", "tabletas", "2300", "20", "10"],
		["Guante látex talle M", "descartable", "unidad", "150", "100", "30"],
	];

	const formatearCelda = (valor) => {
		if (valor === undefined || valor === null) return '""';
		let str = String(valor);
		str = str.replace(/"/g, '""');
		return `"${str}"`;
	};

	const cabecera = headers.map(formatearCelda).join(";");
	const filas = ejemplos.map((fila) => fila.map(formatearCelda).join(";"));
	const csv = [cabecera, ...filas].join("\n");
	const blob = new Blob(["\uFEFF" + csv], {
		type: "text/csv;charset=utf-8;",
	});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = "plantilla_carga_farmacia.csv";
	link.click();
	URL.revokeObjectURL(link.href);
};
/**
 * Parsea un archivo CSV subido por el usuario y lo convierte en un array de objetos
 * con la estructura esperada por el importador.
 * @param {File} file - Archivo CSV a parsear
 * @returns {Promise<Array>} - Promesa que resuelve con los productos parseados
 */
export const parsearArchivoImportacion = (file) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const text = e.target.result;
				// Dividir por saltos de línea y luego por punto y coma
				const lines = text
					.trim()
					.split("\n")
					.map((line) => {
						const values = [];
						let current = "";
						let inQuotes = false;
						for (let i = 0; i < line.length; i++) {
							const ch = line[i];
							if (ch === '"') {
								inQuotes = !inQuotes;
							} else if (ch === ";" && !inQuotes) {
								values.push(
									current.trim().replace(/^"|"$/g, ""),
								);
								current = "";
							} else {
								current += ch;
							}
						}
						values.push(current.trim().replace(/^"|"$/g, ""));
						return values;
					});
				const headers = lines[0].map((h) =>
					h.toLowerCase().replace(/\s+/g, ""),
				);
				const rows = lines.slice(1).filter((r) => r.some((c) => c));
				const productos = rows.map((row) => {
					const obj = {};
					headers.forEach((h, i) => {
						obj[h] = row[i] || "";
					});
					return {
						nombre: obj.nombre || "",
						tipo:
							obj.tipo === "descartable"
								? "descartable"
								: "medicamento",
						presentacion: obj.presentacion || "unidad",
						precio: parseFloat(obj.precio) || 0,
						stockInicial:
							parseInt(obj.stockinicial || obj.stockactual) || 0,
						stockMinimo: parseInt(obj.stockminimo) || 10,
						valido: !!(obj.nombre && parseFloat(obj.precio) > 0),
					};
				});
				resolve(productos);
			} catch (err) {
				reject(err);
			}
		};
		reader.onerror = reject;
		reader.readAsText(file, "UTF-8");
	});
};

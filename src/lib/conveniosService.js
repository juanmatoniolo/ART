import { db } from "./firebase";
import { ref, set, get, update, remove, onValue } from "firebase/database";
import { BASE_VALORES, BASE_HONORARIOS } from "./conveniosBase";

/* 🔹 Crear convenio con estructura base vacía */
export const crearConvenio = async (nombre) => {
	try {
		const data = {
			valores_generales: BASE_VALORES,
			honorarios_medicos: BASE_HONORARIOS,
		};
		await set(ref(db, `convenios/${nombre}`), data);
		return {
			success: true,
			message: `Convenio "${nombre}" creado correctamente.`,
		};
	} catch (error) {
		console.error("❌ Error al crear convenio:", error);
		return { success: false, error: error.message };
	}
};

/* 🔹 Obtener todos los convenios (una sola vez) */
export const obtenerConvenios = async () => {
	try {
		const snapshot = await get(ref(db, "convenios"));
		return snapshot.exists() ? snapshot.val() : {};
	} catch (error) {
		console.error("❌ Error al obtener convenios:", error);
		throw error;
	}
};

/* 🔹 Escuchar cambios en vivo */
export const escucharConvenios = (callback) => {
	const conveniosRef = ref(db, "convenios");
	onValue(conveniosRef, (snapshot) => {
		callback(snapshot.exists() ? snapshot.val() : {});
	});
};

/* 🔹 Actualizar valor de una práctica u honorario */
export const actualizarCampo = async (convenio, tipo, clave, campo, valor) => {
	try {
		const path =
			tipo === "valores_generales"
				? `convenios/${convenio}/valores_generales/${clave}`
				: `convenios/${convenio}/honorarios_medicos/${clave}/${campo}`;
		await set(ref(db, path), valor);
		return { success: true };
	} catch (error) {
		console.error("❌ Error al actualizar campo:", error);
		return { success: false, error: error.message };
	}
};

/* 🔹 Agregar práctica nueva */
export const agregarPractica = async (convenio, nombre, valor = "") => {
	try {
		await set(
			ref(db, `convenios/${convenio}/valores_generales/${nombre}`),
			valor
		);
		return { success: true };
	} catch (error) {
		console.error("❌ Error al agregar práctica:", error);
		return { success: false, error: error.message };
	}
};

/* 🔹 Eliminar práctica */
export const eliminarPractica = async (convenio, nombre) => {
	try {
		await remove(
			ref(db, `convenios/${convenio}/valores_generales/${nombre}`)
		);
		return { success: true };
	} catch (error) {
		console.error("❌ Error al eliminar práctica:", error);
		return { success: false, error: error.message };
	}
};

/* 🔹 Eliminar convenio */
export const eliminarConvenio = async (nombre) => {
	try {
		await remove(ref(db, `convenios/${nombre}`));
		return { success: true };
	} catch (error) {
		console.error("❌ Error al eliminar convenio:", error);
		return { success: false, error: error.message };
	}
};

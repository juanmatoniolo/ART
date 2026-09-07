import { useEffect, useState } from "react";
import {
	ref,
	onValue,
	push,
	set,
	remove,
	update,
	get,
} from "firebase/database"; // ← get importado
import { db } from "@/lib/firebase";

export default function useDoctors() {
	const [doctors, setDoctors] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const doctorsRef = ref(db, "medicos");

		const unsubscribe = onValue(
			doctorsRef,
			(snapshot) => {
				const data = snapshot.val();

				if (data && typeof data === "object") {
					const loaded = Object.entries(data)
						.map(([id, value]) => ({
							id,
							...(value || {}),
						}))
						// ← Ordenar por numero para que doctors[0] = médico #1, etc.
						.sort(
							(a, b) =>
								(Number(a.numero) || 0) -
								(Number(b.numero) || 0),
						);

					setDoctors(loaded);
				} else {
					setDoctors([]);
				}

				setLoading(false);
			},
			(error) => {
				console.error("Error cargando médicos:", error);
				setDoctors([]);
				setLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	const createDoctor = async (doctorData) => {
		const snap = await get(ref(db, "medicos")); // ← ahora funciona
		const data = snap.val() || {};

		const numeros = Object.values(data).map((d) => Number(d.numero) || 0);
		const nextNumero = numeros.length ? Math.max(...numeros) + 1 : 1;

		const newRef = push(ref(db, "medicos"));

		await set(newRef, {
			...doctorData,
			numero: nextNumero,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		return newRef.key;
	};

	const updateDoctor = async (id, doctorData) => {
		await update(ref(db, `medicos/${id}`), {
			...doctorData,
			updatedAt: Date.now(),
		});
	};

	const deleteDoctor = async (id) => {
		if (window.confirm("¿Eliminar este médico?")) {
			await remove(ref(db, `medicos/${id}`));
		}
	};

	return {
		doctors,
		loading,
		createDoctor,
		updateDoctor,
		deleteDoctor,
	};
}

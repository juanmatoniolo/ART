import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { safeNum } from "../../Facturacion/utils/calculos";

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function normalizeTimestamp(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export default function useDoctorDashboard(fechaDesde, fechaHasta) {
	const [facturas, setFacturas] = useState({});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const factRef = ref(db, "Facturacion");

		const unsubscribe = onValue(
			factRef,
			(snap) => {
				setFacturas(snap.exists() ? snap.val() : {});
				setLoading(false);
			},
			(error) => {
				console.error("Error cargando dashboard de médicos:", error);
				setFacturas({});
				setLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	const stats = useMemo(() => {
		const desdeTs = fechaDesde
			? new Date(`${fechaDesde}T00:00:00`).getTime()
			: null;

		const hastaTs = fechaHasta
			? new Date(`${fechaHasta}T23:59:59.999`).getTime()
			: null;

		let totalHonorarios = 0;
		let totalGastos = 0;
		const doctorMap = new Map();

		Object.values(facturas || {}).forEach((fact) => {
			if (!fact || typeof fact !== "object") return;

			const fecha = normalizeTimestamp(
				fact.cerradoAt ?? fact.updatedAt ?? fact.createdAt,
			);

			if (desdeTs !== null && fecha < desdeTs) return;
			if (hastaTs !== null && fecha > hastaTs) return;

			asArray(fact.practicas).forEach((p) => {
				const honor = safeNum(p?.honorarioMedico);
				const gasto = safeNum(p?.gastoSanatorial);

				totalHonorarios += honor;
				totalGastos += gasto;

				const name = p?.prestadorNombre?.trim();
				if (honor > 0 && name) {
					if (!doctorMap.has(name))
						doctorMap.set(name, { count: 0, total: 0 });
					const doc = doctorMap.get(name);
					doc.count += 1;
					doc.total += honor;
				}
			});

			asArray(fact.cirugias).forEach((c) => {
				const honor = safeNum(c?.honorarioMedico);
				const gasto = safeNum(c?.gastoSanatorial);

				totalHonorarios += honor;
				totalGastos += gasto;

				const name = c?.prestadorNombre?.trim();
				if (honor > 0 && name) {
					if (!doctorMap.has(name))
						doctorMap.set(name, { count: 0, total: 0 });
					const doc = doctorMap.get(name);
					doc.count += 1;
					doc.total += honor;
				}
			});

			asArray(fact.laboratorios).forEach((l) => {
				const honor = safeNum(l?.honorarioMedico);
				const gasto = safeNum(l?.gastoSanatorial);

				totalHonorarios += honor;
				totalGastos += gasto;

				const name = l?.prestadorNombre?.trim();
				if (honor > 0 && name) {
					if (!doctorMap.has(name))
						doctorMap.set(name, { count: 0, total: 0 });
					const doc = doctorMap.get(name);
					doc.count += 1;
					doc.total += honor;
				}
			});

			asArray(fact.medicamentos).forEach((m) => {
				totalGastos += safeNum(m?.gastoSanatorial ?? m?.total);
			});

			asArray(fact.descartables).forEach((d) => {
				totalGastos += safeNum(d?.gastoSanatorial ?? d?.total);
			});
		});

		const doctores = Array.from(doctorMap.entries())
			.map(([nombre, data]) => ({
				nombre,
				...data,
			}))
			.sort((a, b) => b.total - a.total);

		return {
			totalHonorarios,
			totalGastos,
			doctores,
		};
	}, [facturas, fechaDesde, fechaHasta]);

	return { stats, loading };
}

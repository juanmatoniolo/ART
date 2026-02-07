"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

export function useRtdbNode(nodePath) {
	const [data, setData] = useState({});
	const [loading, setLoading] = useState(true);
	const [errorMsg, setErrorMsg] = useState("");

	useEffect(() => {
		setLoading(true);
		setErrorMsg("");

		const r = ref(db, nodePath);
		const unsub = onValue(
			r,
			(snap) => {
				setData(snap.val() || {});
				setLoading(false);
			},
			(err) => {
				setErrorMsg(err?.message || "Error al leer datos.");
				setLoading(false);
			},
		);

		return () => {
			try {
				if (typeof unsub === "function") unsub();
			} catch {}
		};
	}, [nodePath]);

	const list = useMemo(() => {
		return Object.entries(data || {}).map(([id, v]) => ({ id, ...v }));
	}, [data]);

	return { data, list, loading, errorMsg };
}

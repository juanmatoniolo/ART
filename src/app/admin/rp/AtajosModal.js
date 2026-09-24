// app/admin/rp/AtajosModal.js
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

export function SaveAtajoModal({ open, onClose, onSave, hasContent }) {
	const [nombre, setNombre] = useState("");

	useEffect(() => {
		if (open) setNombre("");
	}, [open]);
	if (!open) return null;

	const canSave = hasContent && nombre.trim().length >= 3;

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div
				className={styles.modalCard}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles.modalHeader}>
					<h3 className={styles.modalTitle}>💾 Guardar atajo</h3>
					<button className={styles.modalClose} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.modalBody}>
					<p className={styles.modalHelp}>
						Guardá las prácticas y estudios actuales para
						reutilizarlos. Después solo tenés que elegir paciente y
						médico.
					</p>
					<label className={styles.label}>Nombre del atajo</label>
					<input
						className={styles.input}
						placeholder="Ej: Consulta trauma + RX"
						value={nombre}
						onChange={(e) => setNombre(e.target.value)}
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter" && canSave)
								onSave(nombre.trim());
						}}
					/>
					<div className={styles.modalSummary}>
						<b>{hasContent ? "✔" : "✖"}</b> Cargá al menos una
						práctica o estudio primero
					</div>
				</div>
				<div className={styles.modalFooter}>
					<button className={styles.btnGhost} onClick={onClose}>
						Cancelar
					</button>
					<button
						className={styles.btnPrimary}
						disabled={!canSave}
						onClick={() => onSave(nombre.trim())}
					>
						Guardar atajo
					</button>
				</div>
			</div>
		</div>
	);
}

export function AtajosModal({ open, onClose, atajos, onApply, onDelete }) {
	const [filtro, setFiltro] = useState("");

	useEffect(() => {
		if (open) setFiltro("");
	}, [open]);

	const filtrados = useMemo(() => {
		const t = filtro.trim().toLowerCase();
		if (!t) return atajos;
		return atajos.filter((a) =>
			String(a.nombre || "")
				.toLowerCase()
				.includes(t),
		);
	}, [atajos, filtro]);

	if (!open) return null;

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div
				className={`${styles.modalCard} ${styles.modalCardWide}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles.modalHeader}>
					<h3 className={styles.modalTitle}>
						📋 Atajos guardados ({atajos.length})
					</h3>
					<button className={styles.modalClose} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.modalBody}>
					{atajos.length === 0 ? (
						<p className={styles.emptyMsg}>
							Todavía no hay atajos. Cargá prácticas y estudios, y
							después dale a<b> 💾 Guardar atajo</b>.
						</p>
					) : (
						<>
							<input
								className={styles.input}
								placeholder="Buscar atajo…"
								value={filtro}
								onChange={(e) => setFiltro(e.target.value)}
								autoFocus
							/>
							<div className={styles.atajosChipsGrid}>
								{filtrados.length === 0 ? (
									<p className={styles.emptyMsg}>
										No hay atajos que coincidan con “
										{filtro}”.
									</p>
								) : (
									filtrados.map((a) => (
										<div
											key={a.id}
											className={styles.atajoChip}
										>
											<button
												className={styles.atajoChipMain}
												onClick={() => {
													onApply(a);
													onClose();
												}}
												title="Aplicar atajo"
											>
												<span
													className={
														styles.atajoChipNombre
													}
												>
													{a.nombre}
												</span>
												<span
													className={
														styles.atajoChipMeta
													}
												>
													{a.practicas?.length || 0}{" "}
													práctica(s)
													{(a.estudiosLab?.length ||
														0) > 0
														? ` · 🧪 ${a.estudiosLab.length}`
														: ""}
												</span>
											</button>
											<button
												className={
													styles.atajoChipDelete
												}
												onClick={(e) => {
													e.stopPropagation();
													onDelete(a.id);
												}}
												title="Eliminar atajo"
											>
												×
											</button>
										</div>
									))
								)}
							</div>
						</>
					)}
				</div>
				<div className={styles.modalFooter}>
					<button className={styles.btnGhost} onClick={onClose}>
						Cerrar
					</button>
				</div>
			</div>
		</div>
	);
}

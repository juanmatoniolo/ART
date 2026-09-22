import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_OAUTH_CLIENT_ID,
	process.env.GOOGLE_OAUTH_CLIENT_SECRET,
);

oauth2Client.setCredentials({
	refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

export async function POST(req) {
	try {
		const { fileId } = await req.json();

		if (!fileId) {
			return NextResponse.json(
				{ error: "Falta fileId" },
				{ status: 400 },
			);
		}

		try {
			await drive.files.delete({ fileId, supportsAllDrives: true });
		} catch (err) {
			// Códigos de "no existe" que devuelve Google Drive:
			//  - 404  (file not found)
			//  - 410  (gone)
			// También a veces viene en err.response.status
			const status = err?.code || err?.response?.status || err?.status;

			const msg = String(err?.message || "").toLowerCase();

			const noExiste =
				status === 404 ||
				status === 410 ||
				msg.includes("file not found") ||
				msg.includes("not found") ||
				msg.includes("no existe");

			if (noExiste) {
				// El archivo ya no está en Drive. No es un error fatal:
				// devolvemos OK con un flag para que el frontend igual
				// limpie el registro en Firebase.
				console.warn(
					`Drive delete: fileId ${fileId} ya no existía en Drive (${status || "sin status"}). Se considera eliminado.`,
				);
				return NextResponse.json({
					ok: true,
					alreadyGone: true,
					message: "El archivo ya no existía en Drive",
				});
			}

			// Cualquier otro error sí es real
			throw err;
		}

		return NextResponse.json({ ok: true, alreadyGone: false });
	} catch (err) {
		console.error("Drive delete error:", err);
		return NextResponse.json(
			{ error: err?.message || "Error eliminando de Drive" },
			{ status: 500 },
		);
	}
}

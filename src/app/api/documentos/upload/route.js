import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export const runtime = "nodejs";

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_OAUTH_CLIENT_ID,
	process.env.GOOGLE_OAUTH_CLIENT_SECRET,
);

oauth2Client.setCredentials({
	refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

async function getOrCreateFolder(name) {
	const safe = name.replace(/'/g, "\\'");
	const q = `name='${safe}' and '${PARENT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
	const list = await drive.files.list({
		q,
		fields: "files(id, name)",
		supportsAllDrives: true,
		includeItemsFromAllDrives: true,
	});
	if (list.data.files?.length) return list.data.files[0].id;

	const created = await drive.files.create({
		requestBody: {
			name,
			mimeType: "application/vnd.google-apps.folder",
			parents: [PARENT_FOLDER_ID],
		},
		fields: "id",
		supportsAllDrives: true,
	});
	return created.data.id;
}

async function getNextDocumentNumber(folderId) {
	const q = `'${folderId}' in parents and trashed=false and name contains 'documento'`;
	const list = await drive.files.list({
		q,
		fields: "files(name)",
		supportsAllDrives: true,
		includeItemsFromAllDrives: true,
	});
	let max = 0;
	for (const f of list.data.files || []) {
		const m = (f.name || "").match(/documento(\d+)/i);
		if (m) max = Math.max(max, Number(m[1]));
	}
	return max + 1;
}

/* ============================================================
   Detecta el tipo real del archivo subido
============================================================ */
function detectFileType(file) {
	const name = String(file?.name || "").toLowerCase();
	const type = String(file?.type || "").toLowerCase();

	/* PDF */
	if (type === "application/pdf" || name.endsWith(".pdf")) {
		return { ext: "pdf", mimeType: "application/pdf", isPdf: true };
	}

	/* WebP */
	if (type === "image/webp" || name.endsWith(".webp")) {
		return { ext: "webp", mimeType: "image/webp", isPdf: false };
	}

	/* PNG */
	if (type === "image/png" || name.endsWith(".png")) {
		return { ext: "png", mimeType: "image/png", isPdf: false };
	}

	/* JPEG */
	if (
		type === "image/jpeg" ||
		type === "image/jpg" ||
		name.endsWith(".jpg") ||
		name.endsWith(".jpeg")
	) {
		return { ext: "jpg", mimeType: "image/jpeg", isPdf: false };
	}

	/* Fallback: respetamos la extensión del nombre original si existe */
	if (name.includes(".")) {
		const ext = name.split(".").pop();
		return {
			ext,
			mimeType: type || "application/octet-stream",
			isPdf: false,
		};
	}

	/* Último fallback */
	return { ext: "bin", mimeType: "application/octet-stream", isPdf: false };
}

export async function POST(req) {
	try {
		const formData = await req.formData();
		const file = formData.get("file");
		const folderName = formData.get("folderName");

		if (!file || !folderName) {
			return NextResponse.json(
				{ error: "Faltan 'file' o 'folderName'" },
				{ status: 400 },
			);
		}

		/* ✅ Detectar tipo real del archivo */
		const { ext, mimeType, isPdf } = detectFileType(file);

		const folderId = await getOrCreateFolder(folderName);
		const nextNum = await getNextDocumentNumber(folderId);

		/* ✅ Nombre con la extensión correcta */
		const fileName = `documento${nextNum}.${ext}`;

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const stream = Readable.from(buffer);

		console.log(
			`[UPLOAD] Subiendo ${fileName} (${mimeType}, ${buffer.length} bytes)`,
		);

		const uploaded = await drive.files.create({
			requestBody: {
				name: fileName,
				parents: [folderId],
			},
			media: {
				mimeType: mimeType, // ✅ mime correcto según el tipo
				body: stream,
			},
			fields: "id, name, webViewLink, mimeType",
			supportsAllDrives: true,
		});

		/* Hacer visible con link */
		try {
			await drive.permissions.create({
				fileId: uploaded.data.id,
				requestBody: { role: "reader", type: "anyone" },
				supportsAllDrives: true,
			});
		} catch (permErr) {
			console.warn(
				"No se pudo hacer público el archivo:",
				permErr?.message,
			);
		}

		return NextResponse.json({
			ok: true,
			fileId: uploaded.data.id,
			name: uploaded.data.name,
			url: uploaded.data.webViewLink,
			mimeType: uploaded.data.mimeType,
			isPdf,
			folderId,
		});
	} catch (err) {
		console.error("Drive upload error:", err);
		return NextResponse.json(
			{ error: err?.message || "Error subiendo a Drive" },
			{ status: 500 },
		);
	}
}
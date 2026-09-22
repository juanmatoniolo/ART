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

		const folderId = await getOrCreateFolder(folderName);
		const nextNum = await getNextDocumentNumber(folderId);
		const fileName = `documento${nextNum}.webp`;

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const stream = Readable.from(buffer);

		const uploaded = await drive.files.create({
			requestBody: {
				name: fileName,
				parents: [folderId],
			},
			media: {
				mimeType: "image/webp",
				body: stream,
			},
			fields: "id, name, webViewLink",
			supportsAllDrives: true,
		});

		// Hacer el archivo visible (cualquiera con el link puede verlo)
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

import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

const auth = new google.auth.GoogleAuth({
	credentials: {
		client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(
			/\\n/g,
			"\n",
		),
	},
	scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

export async function GET() {
	try {
		const folderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
		const res = await drive.files.get({
			fileId: folderId,
			fields: "id, name, mimeType, owners, capabilities",
			supportsAllDrives: true,
		});
		return NextResponse.json({ ok: true, folder: res.data });
	} catch (err) {
		return NextResponse.json(
			{ ok: false, error: err?.message, code: err?.code },
			{ status: 500 },
		);
	}
}

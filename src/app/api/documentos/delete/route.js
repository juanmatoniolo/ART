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
		await drive.files.delete({ fileId, supportsAllDrives: true });
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("Drive delete error:", err);
		return NextResponse.json(
			{ error: err?.message || "Error eliminando de Drive" },
			{ status: 500 },
		);
	}
}

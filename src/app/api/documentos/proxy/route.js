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

export async function GET(req) {
	const { searchParams } = new URL(req.url);
	const id = searchParams.get("id");

	if (!id) {
		console.error("[proxy] Falta id");
		return new NextResponse("Missing id", { status: 400 });
	}

	try {
		console.log(`[proxy] Pidiendo archivo: ${id}`);

		const res = await drive.files.get(
			{ fileId: id, alt: "media" },
			{ responseType: "arraybuffer" },
		);

		const buf = Buffer.from(res.data);
		console.log(`[proxy] OK ${id} — ${buf.length} bytes`);

		return new NextResponse(buf, {
			status: 200,
			headers: {
				"Content-Type": "image/webp",
				"Content-Length": String(buf.length),
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (err) {
		console.error(`[proxy] ERROR para ${id}:`, err?.message, err?.code);
		return new NextResponse(`Error: ${err?.message || "desconocido"}`, {
			status: 500,
		});
	}
}
